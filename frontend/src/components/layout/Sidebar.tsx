'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  LayoutDashboard,
  MapPin,
  Truck,
  Users,
  Activity,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const patientNav: NavItem[] = [
  { href: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patient/request', label: 'New Emergency', icon: AlertTriangle },
];

const driverNav: NavItem[] = [
  { href: '/driver/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/driver/task', label: 'Active Task', icon: Truck },
];

const adminNav: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/requests', label: 'Requests', icon: ClipboardList },
  { href: '/admin/ambulances', label: 'Ambulances', icon: Truck },
  { href: '/admin/assignments', label: 'Assignments', icon: Activity },
];

interface SidebarProps {
  role: 'patient' | 'driver' | 'admin';
  userName: string;
  onLogout?: () => void;
}

export default function Sidebar({ role, userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = role === 'patient' ? patientNav : role === 'driver' ? driverNav : adminNav;

  const SidebarContent = () => (
    <div className="sidebar" style={{ transform: open ? 'translateX(0)' : undefined }}>
      {/* Logo */}
      <div
        style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--text-primary)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={16} color="var(--bg-base)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
              ResQ
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {role}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '1rem 0.75rem', flex: 1 }}>
        <div style={{ marginBottom: '0.25rem', padding: '0 0.5rem 0.5rem', fontSize: '0.6875rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Navigation
        </div>
        {nav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                textDecoration: 'none',
                marginBottom: '0.125rem',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            marginBottom: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{userName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{role}</div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem' }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'none',
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 60,
          padding: '0.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
        className="mobile-menu-btn"
        aria-label="Toggle menu"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 45,
          }}
        />
      )}

      <SidebarContent />
    </>
  );
}
