'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Truck, MapPin, CheckCircle, Clock,
  RefreshCw, Navigation, User, AlertTriangle, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { assignmentApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useRoute } from '@/hooks/useRoute';
import { computeDijkstraViz } from '@/lib/dijkstraViz';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { PriorityBadge, StatusBadge } from '@/components/dashboard/PriorityBadge';
import { Assignment } from '@/types';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

export default function DriverDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { joinRoom, on, emit, isConnected } = useSocket();

  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Driver's own live location
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);

  // Manual location input
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const locationWatchRef = useRef<number | null>(null);
  // Once the driver submits a manual location, we stop the GPS watcher entirely
  // so it can never fire and snap the marker back to the device's real GPS coords.
  const manualOverrideRef = useRef(false);

  // ── Dijkstra route-search visualisation ─────────────────────────────────────
  // When the driver accepts, we play a flood-fill search over the real road
  // network (driver → patient) before revealing the route. While the flood is
  // playing we hide the plain route line; when it completes we show it.
  const [searchViz, setSearchViz] = useState<{
    segments: [number, number][][];
    source: [number, number];
    target: [number, number];
    runId: number;
  } | null>(null);
  // The shortest path computed by the Dijkstra search itself ([lng,lat][]).
  // Used as the route to lock in when the flood completes — always available,
  // so the route never depends on a racing OSRM fetch.
  const [dijkstraPath, setDijkstraPath] = useState<[number, number][] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchRunIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && user.role !== 'driver') router.push(`/${user.role}/dashboard`);
  }, [user, authLoading]);

  // Join socket rooms
  useEffect(() => {
    if (!user) return;
    joinRoom('join:driver', user.id);
  }, [user, joinRoom]);

  // Join assignment room whenever we have an assignment
  useEffect(() => {
    if (activeAssignment?.id) {
      joinRoom('join:assignment', activeAssignment.id);
    }
  }, [activeAssignment?.id, joinRoom]);

  // Load driver's current assignment
  const loadAssignment = useCallback(async () => {
    if (!user) return;
    try {
      const res = await assignmentApi.getMine();
      if (res.data.success) {
        const assignments = res.data.data as Assignment[];
        const active = assignments.find(
          (a) => !['completed', 'cancelled'].includes(a.status)
        ) || null;
        setActiveAssignment(active);
      }
    } catch {
      // no assignments yet
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadAssignment();
  }, [user, loadAssignment]);

  // Listen for new assignment via socket
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

  // Listen for status changes (e.g. en_route auto-advance from backend)
  useEffect(() => {
    const unsub = on<{ status: string; assignment_id: string }>(
      'request:status_change',
      (data) => {
        setActiveAssignment((prev) => {
          if (!prev || prev.id !== data.assignment_id) return prev;
          return { ...prev, status: data.status as any };
        });
      }
    );
    return unsub;
  }, [on]);

  // GPS auto-tracking when assignment is active
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
          // Skip if the driver has switched to manual mode — don't override their input.
          if (manualOverrideRef.current) return;
          const { latitude, longitude } = pos.coords;
          setDriverPos({ lat: latitude, lng: longitude });
          emit('driver:location_update', {
            assignment_id: activeAssignment.id,
            latitude,
            longitude,
          });
        },
        () => {}, // silently ignore GPS errors — user can use manual input
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

  // ── Action handlers ────────────────────────────────────────────────────────

  // Launch the Dijkstra flood-fill search over the real road network, from the
  // driver's current position to the patient. Falls back silently (no flood,
  // route shows normally) if we can't determine the driver location.
  const startRouteSearch = useCallback(
    async (assignment: Assignment) => {
      const req = assignment.emergency_requests as any;
      const patient =
        req?.latitude && req?.longitude
          ? { lat: req.latitude as number, lng: req.longitude as number }
          : null;
      if (!patient) return;

      // Resolve a driver origin: live GPS state, else a one-shot geolocation read.
      let origin = driverPos;
      if (!origin && typeof navigator !== 'undefined' && navigator.geolocation) {
        origin = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
          );
        });
      }
      if (!origin) return; // no origin → skip flood, route will draw normally

      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      // Hard safety timeout: if Overpass/graph build hangs, abort and let the
      // normal route render so the driver is never stuck on a blank search.
      const safety = setTimeout(() => controller.abort(), 12000);

      setIsSearching(true);
      try {
        const viz = await computeDijkstraViz(
          [origin.lng, origin.lat],
          [patient.lng, patient.lat],
          controller.signal
        );
        clearTimeout(safety);
        const isCurrent = searchAbortRef.current === controller;
        if (controller.signal.aborted) {
          if (isCurrent) setIsSearching(false); // safety-aborted → reveal normal route
          return;
        }
        if (!isCurrent) return; // superseded by a newer search
        if (!viz.exploreSegments.length) {
          // Nothing to flood (degenerate graph) — skip straight to the route.
          setIsSearching(false);
          return;
        }
        searchRunIdRef.current += 1;
        setDijkstraPath(viz.path && viz.path.length > 1 ? viz.path : null);
        setSearchViz({
          segments: viz.exploreSegments,
          source: viz.source,
          target: viz.target,
          runId: searchRunIdRef.current,
        });
      } catch {
        // Any failure → no flood; route falls back to normal rendering.
        clearTimeout(safety);
        if (searchAbortRef.current === controller) setIsSearching(false);
      }
    },
    [driverPos]
  );

  const handleAccept = async () => {
    if (!activeAssignment) return;
    setIsAccepting(true);
    try {
      const res = await assignmentApi.accept(activeAssignment.id);
      if (res.data.success) {
        // Merge: never lose the emergency_requests / ambulances joins even if a
        // backend response comes back bare — the route search needs patient coords.
        const accepted = res.data.data as Assignment;
        const merged: Assignment = {
          ...activeAssignment,
          ...accepted,
          emergency_requests:
            (accepted as any).emergency_requests ?? activeAssignment.emergency_requests,
          ambulances: (accepted as any).ambulances ?? activeAssignment.ambulances,
        };
        setActiveAssignment(merged);
        toast.success('Assignment accepted! Computing shortest route...');
        // Kick off the Dijkstra route-search visualisation (non-blocking).
        startRouteSearch(merged);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAccepting(false);
    }
  };

  const handlePickup = async () => {
    if (!activeAssignment) return;
    setIsPickingUp(true);
    try {
      const res = await assignmentApi.pickup(activeAssignment.id);
      if (res.data.success) {
        setActiveAssignment((prev) => prev ? { ...prev, status: 'picked_up' } : null);
        toast.success('Patient picked up! Head to hospital.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsPickingUp(false);
    }
  };

  const handleComplete = async () => {
    if (!activeAssignment) return;
    setIsCompleting(true);
    try {
      const res = await assignmentApi.complete(activeAssignment.id);
      if (res.data.success) {
        setActiveAssignment(null);
        setDriverPos(null);
        setSearchViz(null);
        setDijkstraPath(null);
        setIsSearching(false);
        toast.success('Trip completed! Great work.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  // Manual location submit
  const handleManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180.');
      return;
    }

    // Lock out GPS: stop the watcher immediately so it cannot override this position.
    manualOverrideRef.current = true;
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }

    setDriverPos({ lat, lng });
    if (activeAssignment) {
      emit('driver:location_update', {
        assignment_id: activeAssignment.id,
        latitude: lat,
        longitude: lng,
      });
    }
    toast.success('Location updated!');
    setShowManualInput(false);
  };

  // ── Derived render values ──────────────────────────────────────────────────
  // These MUST be above any early return (Rules of Hooks: useMemo counts as a hook).
  const emergencyReq = activeAssignment?.emergency_requests as any;

  // Memoized markers — only rebuilds when actual coordinates change.
  // Keeps the LiveMap marker reference stable across unrelated re-renders.
  const mapMarkers = useMemo(() => {
    const result: { lat: number; lng: number; type: 'patient' | 'ambulance'; label: string }[] = [];
    if (emergencyReq?.latitude && emergencyReq?.longitude) {
      result.push({ lat: emergencyReq.latitude, lng: emergencyReq.longitude, type: 'patient', label: 'Patient location' });
    }
    if (driverPos) {
      result.push({ lat: driverPos.lat, lng: driverPos.lng, type: 'ambulance', label: 'Your location' });
    }
    return result;
  }, [emergencyReq?.latitude, emergencyReq?.longitude, driverPos]);

  const mapCenter: [number, number] = driverPos
    ? [driverPos.lat, driverPos.lng]
    : emergencyReq?.latitude
    ? [emergencyReq.latitude, emergencyReq.longitude]
    : [12.97, 77.59];

  // ── Live road route: driver → patient ─────────────────────────────────────
  const patientPos = useMemo(
    () =>
      emergencyReq?.latitude && emergencyReq?.longitude
        ? { lat: emergencyReq.latitude, lng: emergencyReq.longitude }
        : null,
    [emergencyReq?.latitude, emergencyReq?.longitude]
  );
  // Pre-fetch the route geometry as soon as we're heading to the patient
  // (covers reloads mid-trip), but DISPLAY is gated separately below.
  const showRouteToPatient =
    !!activeAssignment &&
    ['assigned', 'accepted', 'en_route'].includes(activeAssignment.status);
  const { route } = useRoute(
    showRouteToPatient ? driverPos : null,
    showRouteToPatient ? patientPos : null
  );

  // Display rules for the final route line:
  //  - Hidden during 'assigned' (before Accept) → driver only sees markers.
  //  - Hidden while the Dijkstra flood is computing/playing (isSearching).
  //  - Shown once status is accepted/en_route AND the flood has finished.
  //    (On a mid-trip reload there's no flood, so it shows immediately.)
  // Prefer the Dijkstra-computed shortest path (always available the instant the
  // flood exists); fall back to the OSRM road route only if no Dijkstra path.
  const routeCoords =
    dijkstraPath && dijkstraPath.length > 1
      ? dijkstraPath
      : route?.coordinates;
  const routeForMap =
    routeCoords &&
    !isSearching &&
    !!activeAssignment &&
    ['accepted', 'en_route'].includes(activeAssignment.status)
      ? { coordinates: routeCoords }
      : undefined;

  // Called by LiveMap when the flood reaches the patient: reveal the route.
  const handleSearchComplete = useCallback(() => {
    setIsSearching(false);
  }, []);

  // Early return AFTER all hooks
  if (authLoading || isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <Sidebar role="driver" userName={user?.name || 'Driver'} onLogout={logout} />
      <div className="main-content">
        <Topbar
          title="Driver Dashboard"
          subtitle={isConnected ? '🟢 Connected' : '🔴 Reconnecting...'}
        />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          {activeAssignment && emergencyReq ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

              {/* ── Map ─────────────────────────────────────────── */}
              <div style={{ position: 'relative' }}>
                <LiveMap
                  center={mapCenter}
                  markers={mapMarkers}
                  route={routeForMap}
                  search={searchViz}
                  onSearchComplete={handleSearchComplete}
                  height="450px"
                  zoom={14}
                />

                {isSearching && (
                  <div
                    style={{
                      position: 'absolute', top: 12, left: 12, zIndex: 20,
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 0.875rem', borderRadius: '8px',
                      background: 'rgba(10,10,10,0.82)', border: '1px solid #2A2A2A',
                      backdropFilter: 'blur(6px)', pointerEvents: 'none',
                    }}
                  >
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%',
                      background: '#7DD3FC', boxShadow: '0 0 10px 2px rgba(125,211,252,0.8)',
                      animation: 'pulse 1.1s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#EDEDED', letterSpacing: '0.04em' }}>
                      Dijkstra · searching shortest path…
                    </span>
                  </div>
                )}

                {/* Manual location panel */}
                <div className="card" style={{ marginTop: '0.875rem', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showManualInput ? '0.875rem' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <Navigation size={14} />
                      {driverPos
                        ? `Your GPS: ${driverPos.lat.toFixed(4)}, ${driverPos.lng.toFixed(4)}`
                        : 'GPS not available — set location manually'}
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      onClick={() => setShowManualInput((v) => !v)}
                      id="toggle-manual-location"
                    >
                      <MapPin size={12} />
                      {showManualInput ? 'Cancel' : 'Set Location'}
                    </button>
                  </div>

                  {showManualInput && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontFamily: 'monospace' }}>
                          LATITUDE
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 12.9716"
                          value={manualLat}
                          onChange={(e) => setManualLat(e.target.value)}
                          style={{
                            width: '100%', background: 'var(--bg-base)',
                            border: '1px solid var(--border)', borderRadius: '6px',
                            padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                            fontSize: '0.875rem', fontFamily: 'monospace',
                          }}
                          id="manual-lat"
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontFamily: 'monospace' }}>
                          LONGITUDE
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 77.5946"
                          value={manualLng}
                          onChange={(e) => setManualLng(e.target.value)}
                          style={{
                            width: '100%', background: 'var(--bg-base)',
                            border: '1px solid var(--border)', borderRadius: '6px',
                            padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                            fontSize: '0.875rem', fontFamily: 'monospace',
                          }}
                          id="manual-lng"
                        />
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                        onClick={handleManualLocation}
                        id="submit-manual-location"
                      >
                        Update
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Task Card ────────────────────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card card-padding animate-slide-up">
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                      <StatusBadge status={activeAssignment.status} />
                      <PriorityBadge priority={emergencyReq.priority} />
                    </div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                      {emergencyReq.emergency_type
                        ?.replace(/_/g, ' ')
                        .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {emergencyReq.description}
                    </p>
                  </div>

                  <div className="divider" style={{ marginBottom: '1.25rem' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                      <User size={14} color="var(--text-muted)" />
                      <span style={{ color: 'var(--text-muted)' }}>
                        Patient coordinates:
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                      <MapPin size={14} color="var(--text-muted)" />
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                        {emergencyReq.latitude?.toFixed(4)}, {emergencyReq.longitude?.toFixed(4)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      <span style={{ color: 'var(--text-muted)' }}>ETA: {activeAssignment.eta} min</span>
                    </div>
                    {showRouteToPatient && route && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                        <Navigation size={14} color="var(--text-muted)" />
                        <span style={{ color: 'var(--text-muted)' }}>
                          Route: {route.distanceKm.toFixed(1)} km to patient
                          {route.fallback && ' (direct)'}
                        </span>
                      </div>
                    )}
                    {driverPos && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                        <Navigation size={14} color="var(--text-muted)" />
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                          You: {driverPos.lat.toFixed(4)}, {driverPos.lng.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Action buttons — sequential flow ── */}

                  {/* Step 1: Accept */}
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

                  {/* Step 2: En route / accepted — heading to patient */}
                  {['accepted', 'en_route'].includes(activeAssignment.status) && (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.75rem', borderRadius: '6px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border)',
                        marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)',
                      }}>
                        <Navigation size={14} style={{ flexShrink: 0 }} />
                        {activeAssignment.status === 'accepted'
                          ? 'Accepted — en route status updates in 10s...'
                          : '🚨 En route to patient — pick them up when you arrive'}
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={handlePickup}
                        disabled={isPickingUp}
                        id="pickup-patient"
                      >
                        {isPickingUp
                          ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Package size={14} />}
                        {isPickingUp ? 'Marking...' : 'Patient Picked Up'}
                      </button>
                    </>
                  )}

                  {/* Step 3: Patient picked up — heading to hospital */}
                  {activeAssignment.status === 'picked_up' && (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.75rem', borderRadius: '6px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border)',
                        marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)',
                      }}>
                        <CheckCircle size={14} style={{ flexShrink: 0 }} />
                        Patient is aboard — drive to the hospital
                      </div>
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
                    </>
                  )}
                </div>

                {/* Status hint card */}
                <div className="card" style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--text-faint)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Trip Flow
                  </div>
                  {[
                    { s: 'assigned', label: 'Assigned — Accept' },
                    { s: 'accepted', label: 'Accepted — Drive to patient' },
                    { s: 'en_route', label: 'En Route — Pick up patient' },
                    { s: 'picked_up', label: 'Picked Up — Drive to hospital' },
                    { s: 'completed', label: 'Completed ✓' },
                  ].map(({ s, label }) => (
                    <div key={s} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.3rem 0',
                      color: activeAssignment.status === s ? 'var(--text-primary)' : 'var(--text-faint)',
                      fontWeight: activeAssignment.status === s ? 600 : 400,
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: activeAssignment.status === s ? 'var(--text-primary)' : 'var(--border)',
                      }} />
                      {label}
                    </div>
                  ))}
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
