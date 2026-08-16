import { Loader2 } from 'lucide-react';
import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
  minHeight?: string | number;
  className?: string;
}

export function LoadingState({
  message = 'Loading...',
  minHeight = '320px',
  className = '',
}: LoadingStateProps) {
  return (
    <div
      className={`gxa-loading-state ${className}`}
      style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
    >
      <Loader2 size={36} className="animate-spin loading-spinner" />
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}
