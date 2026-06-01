'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, MapPin, Loader2, Truck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { EmergencyRequest, RequestStatusEvent } from '@/types';
import { StatusBadge, PriorityBadge } from '@/components/dashboard/PriorityBadge';
import Link from 'next/link';

export default function PatientDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { joinRoom, on } = useSocket();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && user.role !== 'patient') router.push(`/${user.role}/dashboard`);
  }, [user, authLoading]);

  // Join patient socket room for live updates
  useEffect(() => {
    if (user) joinRoom('join:patient', user.id);
  }, [user, joinRoom]);

  // Load requests
  const loadRequests = useCallback(async () => {
    try {
      const res = await emergencyApi.getMy();
      if (res.data.success) setRequests(res.data.data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadRequests();
  }, [user, loadRequests]);

  // Real-time status updates from socket
  useEffect(() => {
    const unsub = on<RequestStatusEvent>('request:status_change', (data) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === data.request_id
            ? {
                ...r,
                status: data.status as any,
                ...(data.priority ? { priority: data.priority as any } : {}),
              }
            : r
        )
      );
      const statusLabel = data.status.replace(/_/g, ' ');
      toast.success(`🚑 Ambulance ${statusLabel}!`);
    });
    return unsub;
  }, [on]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const activeRequest = requests.find(
    (r) => !['completed', 'cancelled'].includes(r.status)
  );
  const pastRequests = requests.filter((r) =>
    ['completed', 'cancelled'].includes(r.status)
  );

  return (
    <div>
      <Sidebar role="patient" userName={user?.name || 'Patient'} onLogout={logout} />
      <div className="main-content">
        <Topbar title="Patient Dashboard" subtitle="Track your emergency requests" />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>

          {/* Active Emergency */}
          {isLoading ? (
            <div className="card card-padding" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading your requests...</span>
            </div>
          ) : activeRequest ? (
            <div
              className="card card-padding animate-slide-up"
              style={{ marginBottom: '1.5rem', border: '1px solid var(--border-strong)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                    <AlertTriangle size={16} color="var(--text-primary)" />
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>Active Emergency</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.875rem' }}>
                    {activeRequest.emergency_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <StatusBadge status={activeRequest.status} />
                    <PriorityBadge priority={activeRequest.priority} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link href={`/patient/track/${activeRequest.id}`} className="btn btn-primary btn-sm">
                    <MapPin size={14} />
                    Track Ambulance
                  </Link>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={loadRequests}
                    title="Refresh"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    <RefreshCw size={13} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Status message based on current state */}
              {activeRequest.status === 'pending' && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.875rem',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  AI is analyzing your request. Genetic Algorithm is selecting the nearest ambulance...
                </div>
              )}

              {activeRequest.status === 'assigned' && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.875rem',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Truck size={14} style={{ flexShrink: 0 }} />
                  An ambulance has been dispatched. Waiting for driver confirmation...
                </div>
              )}

              {['accepted', 'en_route', 'picked_up'].includes(activeRequest.status) && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.875rem',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Truck size={14} style={{ flexShrink: 0 }} />
                  🚑 Ambulance is on its way! Click "Track Ambulance" to see live location.
                </div>
              )}
            </div>
          ) : (
            <div
              className="card card-padding animate-slide-up"
              style={{ marginBottom: '1.5rem', textAlign: 'center' }}
            >
              <AlertTriangle size={32} color="var(--text-faint)" style={{ margin: '1rem auto' }} />
              <div style={{ fontWeight: 500, marginBottom: '0.375rem' }}>No active emergency</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                If you have an emergency, request an ambulance immediately.
              </div>
              <Link href="/patient/request" className="btn btn-primary btn-sm">
                Request Ambulance
              </Link>
            </div>
          )}

          {/* Past Requests */}
          {pastRequests.length > 0 && (
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
                Request History
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pastRequests.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="card"
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        {req.emergency_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem', fontFamily: 'monospace' }}>
                        <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                        {new Date(req.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <PriorityBadge priority={req.priority} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
