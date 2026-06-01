import Link from 'next/link';
import {
  AlertTriangle,
  Zap,
  MapPin,
  Activity,
  Clock,
  Shield,
  ArrowRight,
  Brain,
  GitBranch,
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ResQ — AI Ambulance Allocation System',
  description:
    'Emergency response platform powered by Machine Learning and Genetic Algorithms for optimal ambulance dispatch.',
};

const features = [
  {
    icon: Brain,
    title: 'AI Priority Prediction',
    description:
      'Random Forest classifier predicts emergency urgency — Low, Medium, High, or Critical — in milliseconds.',
  },
  {
    icon: GitBranch,
    title: 'Genetic Algorithm Dispatch',
    description:
      'GA optimizes ambulance selection across distance, traffic, availability, and priority in real time.',
  },
  {
    icon: MapPin,
    title: 'Live GPS Tracking',
    description:
      'Real-time ambulance tracking on an interactive map, just like a modern ride-hailing platform.',
  },
  {
    icon: Clock,
    title: 'Minimized Response Time',
    description:
      'Intelligent routing and zone-balanced dispatch reduces average response time significantly.',
  },
  {
    icon: Activity,
    title: 'Admin Control Center',
    description:
      'Full visibility over all requests, assignments, fleet status, and live analytics in one dashboard.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description:
      'Separate dashboards for patients, drivers, and admins with secure role-gated access.',
  },
];

const steps = [
  { number: '01', title: 'Patient sends request', description: 'Location and emergency details submitted.' },
  { number: '02', title: 'AI predicts priority', description: 'ML model classifies urgency level.' },
  { number: '03', title: 'GA selects ambulance', description: 'Genetic Algorithm finds the optimal dispatch.' },
  { number: '04', title: 'Driver dispatched', description: 'Real-time notification sent to assigned driver.' },
  { number: '05', title: 'Live tracking begins', description: 'Patient tracks ambulance on map with ETA.' },
  { number: '06', title: 'Trip completed', description: 'Status updated and logs stored in database.' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 2.5rem',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          background: 'rgba(5,5,5,0.9)',
          backdropFilter: 'blur(12px)',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
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

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm">
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '7rem 2.5rem 5rem',
          textAlign: 'center',
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.875rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 100,
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            fontFamily: 'var(--font-geist-mono, monospace)',
          }}
        >
          <span
            style={{ width: 7, height: 7, borderRadius: '50%', background: '#ededed', display: 'inline-block' }}
          />
          AI + Genetic Algorithm · Emergency Dispatch
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
          }}
        >
          The fastest route
          <br />
          to every emergency.
        </h1>

        <p
          style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            maxWidth: 560,
            margin: '0 auto 2.5rem',
            lineHeight: 1.65,
          }}
        >
          ResQ combines Machine Learning urgency prediction with Genetic Algorithm
          optimization to dispatch the right ambulance in seconds — not minutes.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register?role=patient" className="btn btn-primary btn-lg">
            Request Emergency
            <ArrowRight size={17} />
          </Link>
          <Link href="/register?role=driver" className="btn btn-secondary btn-lg">
            Driver Portal
          </Link>
          <Link href="/login?role=admin" className="btn btn-ghost btn-lg">
            Admin Dashboard
          </Link>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1px',
            marginTop: '5rem',
            background: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          {[
            { value: '<30s', label: 'Allocation time' },
            { value: '3 Roles', label: 'Patient, Driver, Admin' },
            { value: 'Real-time', label: 'GPS tracking' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '1.75rem',
                background: 'var(--bg-card)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '4rem 2.5rem',
        }}
      >
        <div style={{ marginBottom: '3rem' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            Core Capabilities
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Built for speed. Designed for trust.
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1px',
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                style={{
                  background: 'var(--bg-card)',
                  padding: '2rem',
                  transition: 'background 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <Icon size={18} color="var(--text-secondary)" />
                </div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '4rem 2.5rem',
        }}
      >
        <div style={{ marginBottom: '3rem' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            End-to-End Flow
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            From request to rescue.
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          {steps.map((step) => (
            <div key={step.number} className="card card-padding" style={{ position: 'relative' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  color: 'var(--border-strong)',
                  lineHeight: 1,
                  marginBottom: '0.875rem',
                  fontFamily: 'monospace',
                  letterSpacing: '-0.02em',
                }}
              >
                {step.number}
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {step.title}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {step.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto 6rem',
          padding: '0 2.5rem',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '4rem',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: '1rem',
            }}
          >
            Every second counts.
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>
            Join ResQ and experience the future of emergency response.
          </p>
          <Link href="/register" className="btn btn-primary btn-lg">
            Start Now <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '2rem 2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            ResQ — AI Ambulance Allocation System
          </span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', fontFamily: 'monospace' }}>
          Built with Next.js · Express · Supabase · AI/ML
        </div>
      </footer>
    </div>
  );
}
