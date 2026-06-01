'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Clock, Truck, CheckCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import StatusStepper from '@/components/dashboard/StatusStepper';
import { PriorityBadge, StatusBadge } from '@/components/dashboard/PriorityBadge';
import { EmergencyRequest, DriverLocationEvent, RequestStatusEvent } from '@/types';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

interface AssignmentData {
  id: string;
  eta: number;
  status: string;
  ambulances?: {
    vehicle_number: string;
    latitude: number;
    longitude: number;
    status: string;
  };
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { joinRoom, on, isConnected } = useSocket();

  const [request, setRequest] = useState<EmergencyRequest | null>(null);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [ambulancePos, setAmbulancePos] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  // Load the emergency request + its assignment
  const loadData = useCallback(async () => {
    if (!user || !id) return;
    try {
      // Load the request
      const reqRes = await emergencyApi.getById(id);
      if (reqRes.data.success) {
        setRequest(reqRes.data.data as EmergencyRequest);
      }

      // Load the assignment via the new endpoint (request_id → assignment)
      const asnRes = await emergencyApi.getAssignment(id);
      if (asnRes.data.success && asnRes.data.data) {
        const asn = asnRes.data.data as AssignmentData;
        setAssignment(asn);
        // Seed ambulance position from DB if available
        if (asn.ambulances?.latitude && asn.ambulances?.longitude) {
          setAmbulancePos({
            lat: asn.ambulances.latitude,
            lng: asn.ambulances.longitude,
          });
        }
      }
    } catch {
      // silently ignore — assignment may not exist yet
    } finally {
      setIsLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Join patient socket room so we receive status events
  useEffect(() => {
    if (user) joinRoom('join:patient', user.id);
  }, [user, joinRoom]);

  // Join assignment room once we have an assignment ID
  useEffect(() => {
    if (assignment?.id) joinRoom('join:assignment', assignment.id);
  }, [assignment?.id, joinRoom]);

  // Listen for real-time driver location
  useEffect(() => {
    const unsub = on<DriverLocationEvent>('driver:location_update', (data) => {
      setAmbulancePos({ lat: data.latitude, lng: data.longitude });
    });
    return unsub;
  }, [on]);

  // Listen for status changes → update request status live
  useEffect(() => {
    const unsub = on<RequestStatusEvent>('request:status_change', (data) => {
      setRequest((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: data.status as any,
          ...(data.priority ? { priority: data.priority as any } : {}),
        };
      });
      // Also refresh assignment data to get new ETA etc.
      loadData();
      toast.info(`Status: ${data.status.replace(/_/g, ' ')}`);
    });
    return unsub;
  }, [on, loadData]);

  // Poll every 10s as a fallback if socket is disconnected
  useEffect(() => {
    if (!user || !id) return;
    pollRef.current = setInterval(loadData, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

  if (isLoading || authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!request) {
    return (
      <div>
        <Sidebar role="patient" userName={user?.name || ''} onLogout={logout} />
        <div className="main-content">
          <Topbar title="Track Ambulance" />
          <div className="page-container" style={{ paddingTop: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Request not found.
          </div>
        </div>
      </div>
    );
  }

  const mapMarkers = [
    { lat: request.latitude, lng: request.longitude, type: 'patient' as const, label: 'Your location' },
    ...(ambulancePos
      ? [{ lat: ambulancePos.lat, lng: ambulancePos.lng, type: 'ambulance' as const, label: `Ambulance · ${assignment?.ambulances?.vehicle_number ?? ''}` }]
      : []),
  ];

  return (
    <div>
      <Sidebar role="patient" userName={user?.name || ''} onLogout={logout} />
      <div className="main-content">
        <Topbar
          title="Live Tracking"
          subtitle={isConnected ? '🟢 Connected' : '🔴 Reconnecting...'}
        />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

            {/* Map + ETA */}
            <div>
              <LiveMap
                center={[request.latitude, request.longitude]}
                markers={mapMarkers}
                height="460px"
                zoom={14}
              />

              {/* Assignment Info Card */}
              {assignment ? (
                <div
                  className="card"
                  style={{ marginTop: '1rem', padding: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  {/* ETA */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Estimated Arrival
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={18} />
                      {assignment.eta} min
                    </div>
                  </div>

                  {/* Vehicle */}
                  {assignment.ambulances?.vehicle_number && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Ambulance
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}>
                        <Truck size={16} />
                        {assignment.ambulances.vehicle_number}
                      </div>
                    </div>
                  )}

                  {/* Priority */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Priority</div>
                    <PriorityBadge priority={request.priority} />
                  </div>

                  {/* Assignment status */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Driver Status</div>
                    <StatusBadge status={assignment.status as any} />
                  </div>
                </div>
              ) : (
                /* No assignment yet — AI is processing */
                <div
                  className="card card-padding"
                  style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
                >
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  AI + Genetic Algorithm is selecting the nearest ambulance...
                </div>
              )}
            </div>

            {/* Status Stepper */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <StatusStepper currentStatus={request.status} />

              {/* Live confirmation when assigned */}
              {assignment && request.status !== 'pending' && (
                <div
                  className="card card-padding animate-slide-up"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}
                >
                  <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                      Ambulance dispatched
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {assignment.ambulances?.vehicle_number
                        ? `${assignment.ambulances.vehicle_number} is en route to you.`
                        : 'An ambulance is on its way.'}
                    </div>
                    {ambulancePos && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={11} />
                        Live GPS: {ambulancePos.lat.toFixed(4)}, {ambulancePos.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
