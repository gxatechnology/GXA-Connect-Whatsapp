import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  detail?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  detail,
  badge,
  onClick,
  className = '',
}: StatCardProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div
      className={`gxa-stat-card ${onClick ? 'interactive' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <Icon className="stat-watermark" aria-hidden="true" />
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-icon-wrap">
          <Icon size={18} className="stat-card-icon" />
        </div>
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{formattedValue}</div>
        {badge && <div className="stat-card-badge">{badge}</div>}
      </div>
      {detail && <div className="stat-card-detail">{detail}</div>}
    </div>
  );
}
