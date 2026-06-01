'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, AlertTriangle, Loader2, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

const EMERGENCY_TYPES = [
  { value: 'cardiac_arrest', label: 'Cardiac Arrest' },
  { value: 'accident', label: 'Road Accident' },
  { value: 'stroke', label: 'Stroke' },
  { value: 'respiratory', label: 'Respiratory Distress' },
  { value: 'trauma', label: 'Physical Trauma' },
  { value: 'fire', label: 'Fire / Burns' },
  { value: 'drowning', label: 'Drowning' },
  { value: 'other', label: 'Other Emergency' },
];

export default function RequestPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [form, setForm] = useState({
    emergency_type: 'cardiac_arrest',
    description: '',
    latitude: 12.9716,
    longitude: 77.5946,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationSet, setLocationSet] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setLocationSet(true);
        setIsLocating(false);
        toast.success('Location detected');
      },
      (err) => {
        toast.error('Could not detect location. Please allow access.');
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) {
      toast.error('Please describe the emergency');
      return;
    }
    if (!locationSet) {
      toast.error('Please detect your location first');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await emergencyApi.create(form);
      if (res.data.success) {
        toast.success('Emergency request sent! Allocating ambulance...');
        router.push('/patient/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Sidebar role="patient" userName={user?.name || 'Patient'} onLogout={logout} />
      <div className="main-content">
        <Topbar title="Request Ambulance" subtitle="Fill in your emergency details" />

        <div className="page-container" style={{ paddingTop: '1.5rem', maxWidth: 800 }}>
          <div className="card card-padding animate-slide-up">
            {/* Warning banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '2rem',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
              }}
            >
              <AlertTriangle size={16} color="var(--text-primary)" />
              <span>
                <strong>For life-threatening emergencies only.</strong> Misuse may delay help to
                others.
              </span>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Emergency type */}
              <div className="input-group">
                <label className="input-label" htmlFor="emergency-type">Emergency Type *</label>
                <select
                  id="emergency-type"
                  className="input"
                  value={form.emergency_type}
                  onChange={(e) => setForm((p) => ({ ...p, emergency_type: e.target.value }))}
                  style={{ appearance: 'none', cursor: 'pointer' }}
                >
                  {EMERGENCY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="input-group">
                <label className="input-label" htmlFor="description">Emergency Description *</label>
                <textarea
                  id="description"
                  className="input"
                  placeholder="Briefly describe what happened..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  minLength={5}
                  maxLength={500}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'right' }}>
                  {form.description.length}/500
                </div>
              </div>

              {/* Location */}
              <div>
                <div className="input-label" style={{ marginBottom: '0.5rem' }}>
                  Your Location *
                </div>
                <button
                  type="button"
                  id="detect-location"
                  className="btn btn-secondary"
                  onClick={detectLocation}
                  disabled={isLocating}
                  style={{ marginBottom: '0.75rem' }}
                >
                  {isLocating ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Navigation size={14} />
                  )}
                  {isLocating ? 'Detecting...' : locationSet ? '✓ Location Detected' : 'Detect My Location'}
                </button>

                {/* Mini map preview */}
                <LiveMap
                  center={[form.latitude, form.longitude]}
                  zoom={14}
                  markers={[
                    { lat: form.latitude, lng: form.longitude, type: 'patient', label: 'Your location' },
                  ]}
                  height="220px"
                />

                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.5rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </div>
              </div>

              <button
                type="submit"
                id="submit-emergency"
                className="btn btn-primary"
                disabled={isSubmitting || !locationSet}
                style={{ padding: '0.875rem', fontSize: '1rem' }}
              >
                {isSubmitting ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                {isSubmitting ? 'Sending Request...' : 'Send Emergency Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
