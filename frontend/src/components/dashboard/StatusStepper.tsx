import { RequestStatus } from '@/types';
import { CheckCircle, Clock, Truck, MapPin, Package, XCircle } from 'lucide-react';

const steps: { status: RequestStatus; label: string; icon: React.ElementType }[] = [
  { status: 'pending', label: 'Request Sent', icon: Clock },
  { status: 'assigned', label: 'Ambulance Assigned', icon: Package },
  { status: 'accepted', label: 'Driver Accepted', icon: CheckCircle },
  { status: 'en_route', label: 'En Route', icon: Truck },
  { status: 'picked_up', label: 'Patient Picked Up', icon: MapPin },
  { status: 'completed', label: 'Completed', icon: CheckCircle },
];

const statusOrder: Record<RequestStatus, number> = {
  pending: 0,
  assigned: 1,
  accepted: 2,
  en_route: 3,
  picked_up: 4,
  completed: 5,
  cancelled: -1,
};

interface StatusStepperProps {
  currentStatus: RequestStatus;
}

export default function StatusStepper({ currentStatus }: StatusStepperProps) {
  if (currentStatus === 'cancelled') {
    return (
      <div
        className="card card-padding"
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <XCircle size={20} color="var(--status-cancelled)" />
        <div>
          <div style={{ fontWeight: 500 }}>Request Cancelled</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            This emergency request has been cancelled.
          </div>
        </div>
      </div>
    );
  }

  const currentOrder = statusOrder[currentStatus];

  return (
    <div className="card card-padding">
      <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
        Status Timeline
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {steps.map((step, idx) => {
          const stepOrder = idx;
          const isDone = currentOrder > stepOrder;
          const isActive = currentOrder === stepOrder;
          const isFuture = currentOrder < stepOrder;
          const Icon = step.icon;

          return (
            <div key={step.status} style={{ display: 'flex', gap: '0.875rem' }}>
              {/* Icon + Line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDone
                      ? 'var(--text-primary)'
                      : isActive
                      ? 'var(--bg-elevated)'
                      : 'var(--bg-deep)',
                    border: `1px solid ${
                      isDone
                        ? 'var(--text-primary)'
                        : isActive
                        ? 'var(--border-strong)'
                        : 'var(--border)'
                    }`,
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    size={14}
                    color={isDone ? 'var(--bg-base)' : isActive ? 'var(--text-primary)' : 'var(--text-faint)'}
                  />
                </div>
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      minHeight: 24,
                      background: isDone ? 'var(--text-muted)' : 'var(--border)',
                      margin: '4px 0',
                    }}
                  />
                )}
              </div>
              {/* Label */}
              <div style={{ paddingBottom: idx < steps.length - 1 ? '1.25rem' : 0, paddingTop: '0.375rem' }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isDone
                      ? 'var(--text-secondary)'
                      : isActive
                      ? 'var(--text-primary)'
                      : 'var(--text-faint)',
                  }}
                >
                  {step.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
