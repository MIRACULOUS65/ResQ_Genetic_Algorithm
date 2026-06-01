import axios from 'axios';
import { supabaseAdmin } from '../../config/supabase';
import { env } from '../../config/env';
import {
  EmergencyRequest,
  Ambulance,
  Assignment,
  Priority,
  AllocationOutput,
  PredictionOutput,
} from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { getAvailableAmbulancesService, updateAmbulanceStatusService } from '../ambulance/ambulance.service';
import { updateEmergencyStatusService } from '../emergency/emergency.service';
import { getIo } from '../../sockets/socket';

// ─── Haversine Distance ───────────────────────────────────────────────────────

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Priority Prediction (AI-ML Service or Fallback) ─────────────────────────

async function predictPriority(
  request: EmergencyRequest
): Promise<PredictionOutput> {
  try {
    const now = new Date();
    const payload = {
      emergency_type: request.emergency_type,
      hour: now.getHours(),
      day_of_week: now.getDay(),
      traffic_level: 3, // default medium — real data from ORS in production
      weather: 'clear',
      latitude: request.latitude,
      longitude: request.longitude,
    };

    const { data } = await axios.post<PredictionOutput>(
      `${env.AI_ML_SERVICE_URL}/predict`,
      payload,
      { timeout: 5000 }
    );
    return data;
  } catch {
    // Fallback: rule-based priority
    console.warn('⚠️  AI-ML service unavailable. Using rule-based fallback.');
    const highPriorityTypes = ['cardiac_arrest', 'stroke', 'respiratory'];
    const priority: Priority = highPriorityTypes.includes(request.emergency_type)
      ? 'critical'
      : 'high';
    return { priority, confidence: 0.6 };
  }
}

// ─── Genetic Algorithm (Inline Fallback if Python service down) ──────────────

function findBestAmbulanceGA(
  request: EmergencyRequest,
  ambulances: Ambulance[],
  priority: Priority
): AllocationOutput {
  if (ambulances.length === 0) {
    throw new AppError('No available ambulances', 503);
  }

  // Priority weights for fitness scoring
  const priorityMultiplier: Record<Priority, number> = {
    critical: 2.0,
    high: 1.5,
    medium: 1.0,
    low: 0.8,
  };
  const multiplier = priorityMultiplier[priority];

  // Population: each individual is [ambulance_index, fitness_score]
  type Individual = { idx: number; fitness: number };

  const evaluate = (idx: number): Individual => {
    const amb = ambulances[idx];
    const distance = haversineKm(
      request.latitude, request.longitude,
      amb.latitude, amb.longitude
    );
    // Simple fitness: inverse distance weighted by priority
    const fitness = (multiplier * 100) / (distance + 1);
    return { idx, fitness };
  };

  // Initial population
  let population: Individual[] = ambulances.map((_, i) => evaluate(i));

  // Sort by fitness descending (selection)
  population.sort((a, b) => b.fitness - a.fitness);

  // Take top half, run a few crossover + mutation cycles
  const GENERATIONS = 5;
  for (let g = 0; g < GENERATIONS; g++) {
    const top = population.slice(0, Math.ceil(population.length / 2));
    // Crossover: swap indices between pairs and re-evaluate
    const offspring: Individual[] = [];
    for (let i = 0; i < top.length - 1; i += 2) {
      offspring.push(evaluate(top[i + 1].idx)); // simple single-point crossover
    }
    // Mutation: random re-evaluation of one random index
    const mutIdx = Math.floor(Math.random() * ambulances.length);
    offspring.push(evaluate(mutIdx));
    // Merge and select
    population = [...top, ...offspring].sort((a, b) => b.fitness - a.fitness);
  }

  const best = population[0];
  const bestAmbulance = ambulances[best.idx];
  const distKm = haversineKm(
    request.latitude, request.longitude,
    bestAmbulance.latitude, bestAmbulance.longitude
  );
  // Average ambulance speed ~40 km/h in city traffic
  const etaMinutes = Math.round((distKm / 40) * 60);

  return {
    ambulance_id: bestAmbulance.id,
    estimated_eta: etaMinutes,
    distance_km: Math.round(distKm * 10) / 10,
  };
}

// ─── Full Allocation Pipeline ─────────────────────────────────────────────────

export const triggerAllocationService = async (
  request: EmergencyRequest
): Promise<Assignment> => {
  const io = getIo();

  // Step 1: Predict priority
  const { priority } = await predictPriority(request);
  await updateEmergencyStatusService(request.id, 'pending', priority);

  // Step 2: Get available ambulances
  const ambulances = await getAvailableAmbulancesService();

  // Step 3: GA allocation
  const allocation = findBestAmbulanceGA(request, ambulances, priority);

  // Step 4: Save assignment
  const { data: assignment, error } = await supabaseAdmin
    .from('assignments')
    .insert({
      request_id: request.id,
      ambulance_id: allocation.ambulance_id,
      eta: allocation.estimated_eta,
      assigned_at: new Date().toISOString(),
      status: 'assigned',
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Step 5: Update request and ambulance status
  await updateEmergencyStatusService(request.id, 'assigned', priority);
  await updateAmbulanceStatusService(allocation.ambulance_id, 'busy');

  // Step 6: Real-time notifications
  // Fetch the chosen ambulance to get driver_id
  const { data: ambRow } = await supabaseAdmin
    .from('ambulances')
    .select('driver_id')
    .eq('id', allocation.ambulance_id)
    .single();

  // Fetch the full assignment with joins for the notification payload
  const { data: fullAssignment } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .eq('id', assignment.id)
    .single();

  const notifyPayload = {
    assignment: fullAssignment || assignment,
    request: { ...request, priority },
    eta: allocation.estimated_eta,
  };

  // Notify specific driver by user ID (if ambulance has a driver linked)
  if (ambRow?.driver_id) {
    io.to(`driver:${ambRow.driver_id}`).emit('assignment:new', notifyPayload);
  }
  // Also broadcast to ALL drivers room so unlinked drivers can see it
  io.to('drivers').emit('assignment:new', notifyPayload);
  // Admin room
  io.to('admin').emit('assignment:new', notifyPayload);

  io.to(`patient:${request.patient_id}`).emit('request:status_change', {
    request_id: request.id,
    status: 'assigned',
    priority,
    assignment_id: assignment.id,
    eta: allocation.estimated_eta,
  });

  return assignment as Assignment;
};

// ─── Assignment CRUD ──────────────────────────────────────────────────────────

export const getAssignmentByIdService = async (id: string): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError('Assignment not found', 404);
  return data as unknown as Assignment;
};

export const getAllAssignmentsService = async (): Promise<Assignment[]> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .order('assigned_at', { ascending: false });

  if (error) throw new AppError(error.message, 500);
  return (data || []) as unknown as Assignment[];
};

/**
 * Get assignments for the currently-logged-in driver.
 * Looks up their ambulance by driver_id = user.id, then returns assignments for that ambulance.
 * If no ambulance is linked yet, returns the most recent unassigned active assignments
 * so the driver can still pick up work.
 */
export const getMyAssignmentsService = async (driverId: string): Promise<Assignment[]> => {
  // Find ambulance linked to this driver
  const { data: ambData } = await supabaseAdmin
    .from('ambulances')
    .select('id')
    .eq('driver_id', driverId)
    .single();

  if (ambData?.id) {
    // Driver has an ambulance — return its assignments
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .select('*, emergency_requests(*), ambulances(*)')
      .eq('ambulance_id', ambData.id)
      .not('status', 'in', '("completed","cancelled")')
      .order('assigned_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    return (data || []) as unknown as Assignment[];
  }

  // No ambulance linked — return all active assignments (driver can claim any)
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .not('status', 'in', '("completed","cancelled")')
    .order('assigned_at', { ascending: false })
    .limit(10);

  if (error) throw new AppError(error.message, 500);
  return (data || []) as unknown as Assignment[];
};

export const acceptAssignmentService = async (
  id: string
): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update({
      accepted_at: new Date().toISOString(),
      status: 'accepted',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Also update the emergency request status
  await updateEmergencyStatusService((data as any).request_id, 'accepted');

  // Fetch request so we can notify the patient by their patient room
  const { data: reqRow } = await supabaseAdmin
    .from('emergency_requests')
    .select('patient_id')
    .eq('id', (data as any).request_id)
    .single();

  if (reqRow?.patient_id) {
    const io = getIo();
    io.to(`patient:${reqRow.patient_id}`).emit('request:status_change', {
      request_id: (data as any).request_id,
      status: 'accepted',
      assignment_id: id,
    });
  }

  return data as unknown as Assignment;
};

/**
 * Auto-advance assignment from accepted → en_route.
 * Called by setTimeout 10 seconds after driver accepts.
 * Uses top-level imports (no dynamic import) so it always works in CJS.
 */
export const enRouteAssignmentService = async (id: string): Promise<void> => {
  const io = getIo();

  const { data: asnRow } = await supabaseAdmin
    .from('assignments')
    .select('request_id, status')
    .eq('id', id)
    .single();

  // Only advance if driver hasn't already moved to a later status
  if (!asnRow || asnRow.status !== 'accepted') return;

  await supabaseAdmin
    .from('assignments')
    .update({ status: 'en_route' })
    .eq('id', id);

  await updateEmergencyStatusService(asnRow.request_id, 'en_route');

  const { data: reqRow } = await supabaseAdmin
    .from('emergency_requests')
    .select('patient_id')
    .eq('id', asnRow.request_id)
    .single();

  const payload = {
    request_id: asnRow.request_id,
    status: 'en_route',
    assignment_id: id,
  };

  io.to(`assignment:${id}`).emit('request:status_change', payload);
  if (reqRow?.patient_id) {
    io.to(`patient:${reqRow.patient_id}`).emit('request:status_change', payload);
  }

  console.log(`✅ auto en_route fired for assignment ${id}`);
};

export const pickupAssignmentService = async (
  id: string
): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update({ status: 'picked_up' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  await updateEmergencyStatusService((data as any).request_id, 'picked_up');

  // Notify patient
  const { data: reqRow } = await supabaseAdmin
    .from('emergency_requests')
    .select('patient_id')
    .eq('id', (data as any).request_id)
    .single();

  const io = getIo();
  io.to(`assignment:${id}`).emit('request:status_change', {
    request_id: (data as any).request_id,
    status: 'picked_up',
    assignment_id: id,
  });
  if (reqRow?.patient_id) {
    io.to(`patient:${reqRow.patient_id}`).emit('request:status_change', {
      request_id: (data as any).request_id,
      status: 'picked_up',
      assignment_id: id,
    });
  }

  return data as unknown as Assignment;
};

export const completeAssignmentService = async (
  id: string
): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update({
      completed_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Update related records
  await updateEmergencyStatusService((data as any).request_id, 'completed');
  await updateAmbulanceStatusService((data as any).ambulance_id, 'available');

  return data as unknown as Assignment;
};
