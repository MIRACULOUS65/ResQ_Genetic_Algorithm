import { Priority, RequestStatus } from '@/types';

interface PriorityBadgeProps {
  priority: Priority | null;
}

const priorityConfig: Record<Priority, { label: string; pulse: boolean }> = {
  low: { label: 'Low', pulse: false },
  medium: { label: 'Medium', pulse: false },
  high: { label: 'High', pulse: false },
  critical: { label: 'Critical', pulse: true },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (!priority) {
    return (
      <span className="badge" style={{ color: 'var(--text-faint)', borderColor: 'var(--border)' }}>
        —
      </span>
    );
  }
  const config = priorityConfig[priority];
  return (
    <span
      className={`badge priority-${priority} ${config.pulse ? 'pulse-critical' : ''}`}
    >
      {config.label}
    </span>
  );
}

interface StatusBadgeProps {
  status: RequestStatus;
}

const statusLabels: Record<RequestStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  accepted: 'Accepted',
  en_route: 'En Route',
  picked_up: 'Picked Up',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge badge-${status}`}>{statusLabels[status]}</span>
  );
}
