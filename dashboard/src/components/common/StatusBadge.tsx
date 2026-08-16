import './StatusBadge.css';

export type StatusVariant =
  | 'connected'
  | 'ready'
  | 'disconnected'
  | 'idle'
  | 'initializing'
  | 'connecting'
  | 'authenticating'
  | 'qr_ready'
  | 'action_required'
  | 'failed'
  | 'error'
  | 'running'
  | 'completed'
  | 'paused'
  | 'scheduled'
  | 'draft'
  | 'queued'
  | 'cancelled'
  | 'active'
  | 'inactive'
  | 'revoked'
  | 'info'
  | 'warning'
  | 'success';

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, className = '', size = 'md' }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/[\s-]/g, '_');
  const displayLabel = label || status;

  return (
    <span className={`gxa-status-badge ${normalized} size-${size} ${className}`}>
      <span className="badge-dot" />
      <span className="badge-label">{displayLabel}</span>
    </span>
  );
}
