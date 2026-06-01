'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Truck, MapPin, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { assignmentApi, ambulanceApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { PriorityBadge, StatusBadge } from '@/components/dashboard/PriorityBadge';
import { Assignment } from '@/types';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

export default function DriverDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { joinRoom, on, emit } = useSocket();
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const locationWatchRef = useRef<number | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && user.role !== 'driver') router.push(`/${user.role}/dashboard`);
  }, [user, authLoading]);

  // Join socket room using USER ID (not ambulance ID)
  useEffect(() => {
    if (!user) return;
    joinRoom('join:driver', user.id);
  }, [user, joinRoom]);

  // Load driver's current assignment via /mine
  const loadAssignment = async () => {
    if (!user) return;
    try {
      const res = await assignmentApi.getMine();
      if (res.data.success) {
        const assignments = res.data.data as Assignment[];
        // Pick the first active assignment
        const active = assignments.find(
          (a) => !['completed', 'cancelled'].includes(a.status)
        ) || null;
        setActiveAssignment(active);
      }
    } catch {
      // No assignments yet — that's fine
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadAssignment();
  }, [user]);

  // Listen for new assignments via socket (fires for all drivers room)
  useEffect(() => {
    const unsub = on<{ assignment: Assignment; request: any; eta: number }>(
      'assignment:new',
      ({ assignment }) => {
        setActiveAssignment(assignment);
        toast.success('🚨 New emergency assignment!', { duration: 8000 });
      }
    );
    return unsub;
  }, [on]);

  // GPS tracking when assignment is active
  useEffect(() => {
    if (!activeAssignment || ['completed', 'cancelled'].includes(activeAssignment.status)) {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      return;
    }

    if (navigator.geolocation && locationWatchRef.current === null) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          emit('driver:location_update', {
            assignment_id: activeAssignment.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          // Also update via REST for persistence
          ambulanceApi.updateLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            assignment_id: activeAssignment.id,
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [activeAssignment?.id]);

  const handleAccept = async () => {
    if (!activeAssignment) return;
    setIsAccepting(true);
    try {
      const res = await assignmentApi.accept(activeAssignment.id);
      if (res.data.success) {
        setActiveAssignment(res.data.data);
        toast.success('Assignment accepted! Navigate to the patient.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleComplete = async () => {
    if (!activeAssignment) return;
    setIsCompleting(true);
    try {
      const res = await assignmentApi.complete(activeAssignment.id);
      if (res.data.success) {
        setActiveAssignment(null);
        toast.success('Trip completed! Great work.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const emergencyReq = activeAssignment?.emergency_requests as any;

  return (
    <div>
      <Sidebar role="driver" userName={user?.name || 'Driver'} onLogout={logout} />
      <div className="main-content">
        <Topbar title="Driver Dashboard" subtitle="Your active assignment" />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          {activeAssignment && emergencyReq ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
              {/* Map */}
              <div>
                <LiveMap
                  center={[emergencyReq.latitude ?? 12.97, emergencyReq.longitude ?? 77.59]}
                  markers={[
                    {
                      lat: emergencyReq.latitude,
                      lng: emergencyReq.longitude,
                      type: 'patient',
                      label: 'Patient location',
                    },
                  ]}
                  height="450px"
                  zoom={14}
                />
              </div>

              {/* Task Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card card-padding animate-slide-up">
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                      <StatusBadge status={activeAssignment.status} />
                      <PriorityBadge priority={emergencyReq.priority} />
                    </div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                      {emergencyReq.emergency_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {emergencyReq.description}
                    </p>
                  </div>

                  <div className="divider" style={{ marginBottom: '1.25rem' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                      <MapPin size={14} color="var(--text-muted)" />
                      <span style={{ color: 'var(--text-muted)' }}>
                        {emergencyReq.latitude?.toFixed(4)}, {emergencyReq.longitude?.toFixed(4)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      <span style={{ color: 'var(--text-muted)' }}>ETA: {activeAssignment.eta} min</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {activeAssignment.status === 'assigned' && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                      onClick={handleAccept}
                      disabled={isAccepting}
                      id="accept-assignment"
                    >
                      {isAccepting
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <CheckCircle size={14} />}
                      {isAccepting ? 'Accepting...' : 'Accept Assignment'}
                    </button>
                  )}

                  {['accepted', 'en_route', 'picked_up'].includes(activeAssignment.status) && (
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%' }}
                      onClick={handleComplete}
                      disabled={isCompleting}
                      id="complete-trip"
                    >
                      {isCompleting
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <CheckCircle size={14} />}
                      {isCompleting ? 'Completing...' : 'Mark Trip Completed'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="card card-padding animate-slide-up"
              style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto' }}
            >
              <Truck size={40} color="var(--text-faint)" style={{ margin: '1.5rem auto' }} />
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
                No active assignment
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                You will be notified automatically when a new emergency is dispatched.
                Use the button below to check for pending assignments.
              </div>
              <button
                className="btn btn-secondary"
                onClick={loadAssignment}
                style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}
                id="refresh-assignments"
              >
                <RefreshCw size={14} />
                Check for Assignments
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
