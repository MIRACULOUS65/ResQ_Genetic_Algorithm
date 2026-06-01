'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth';

const roles = [
  { value: 'patient', label: 'Patient', description: 'Request emergency assistance' },
  { value: 'driver', label: 'Driver', description: 'Respond to emergency dispatches' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'patient' as 'patient' | 'driver',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all required fields');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        name: form.name,
        email: form.email,
        password: form.password,
        // @ts-ignore — role is an extended field
        role: form.role,
        phone: form.phone,
      });
      if (error) {
        toast.error(error.message || 'Registration failed');
        return;
      }
      // Sign in immediately after registration to get session token
      const { data: signInData } = await authClient.signIn.email({
        email: form.email,
        password: form.password,
      });
      if (signInData?.token) {
        localStorage.setItem('auth_token', signInData.token);
      }
      toast.success('Account created! Redirecting...');
      if (form.role === 'driver') router.push('/driver/dashboard');
      else router.push('/patient/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        padding: '1.5rem',
      }}
    >
      <div
        className="card animate-slide-up"
        style={{ width: '100%', maxWidth: 460, padding: '2.5rem' }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '2rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              background: 'var(--text-primary)',
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={17} color="var(--bg-base)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>ResQ</span>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Create account
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Register to access the emergency response platform.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          {/* Role selector */}
          <div>
            <label className="input-label">Account type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.375rem' }}>
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => handleChange('role', r.value)}
                  style={{
                    padding: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${form.role === r.value ? 'var(--text-muted)' : 'var(--border)'}`,
                    background: form.role === r.value ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                    {r.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="name">Full name *</label>
            <input
              id="name"
              type="text"
              className="input"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-email">Email *</label>
            <input
              id="reg-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              className="input"
              placeholder="+91 9876543210"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-password">Password *</label>
            <input
              id="reg-password"
              type="password"
              className="input"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            id="register-submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {isLoading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.5rem 0' }} />

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
