// ============================================================
// Shared TypeScript Types — Frontend
// ============================================================

export type UserRole = 'patient' | 'driver' | 'admin';

export type EmergencyType =
  | 'cardiac_arrest'
  | 'accident'
  | 'stroke'
  | 'respiratory'
  | 'trauma'
  | 'fire'
  | 'drowning'
  | 'other';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'picked_up'
  | 'completed'
  | 'cancelled';

export type AmbulanceStatus = 'available' | 'busy' | 'offline';

// ── DB Models ──────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  created_at: string;
}

export interface Ambulance {
  id: string;
  driver_id: string | null;
  vehicle_number: string;
  status: AmbulanceStatus;
  latitude: number;
  longitude: number;
  last_updated: string;
}

export interface Hospital {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  contact_number?: string;
  capacity: number;
}

export interface EmergencyRequest {
  id: string;
  patient_id: string;
  emergency_type: EmergencyType;
  description: string;
  priority: Priority | null;
  status: RequestStatus;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  request_id: string;
  ambulance_id: string;
  eta: number;
  status: RequestStatus;
  assigned_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  // Joined fields
  emergency_requests?: EmergencyRequest;
  ambulances?: Ambulance;
}

export interface TrackingLog {
  id: string;
  assignment_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

// ── API Response ────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ── Admin Metrics ───────────────────────────────────────────────

export interface AdminMetrics {
  requests: {
    total: number;
    pending: number;
    active: number;
    completed: number;
    critical: number;
  };
  ambulances: {
    total: number;
    available: number;
    busy: number;
    offline: number;
  };
  assignments: {
    total: number;
    average_eta_minutes: number;
  };
}

// ── Socket Events ────────────────────────────────────────────────

export interface DriverLocationEvent {
  ambulance_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  assignment_id?: string;
}

export interface RequestStatusEvent {
  request_id?: string;
  status: RequestStatus;
  assignment_id: string;
  priority?: Priority;
  eta?: number;
}

export interface NewAssignmentEvent {
  assignment: Assignment;
  request: EmergencyRequest;
  eta: number;
}
