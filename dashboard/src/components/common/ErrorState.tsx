import { AlertCircle, RefreshCw } from 'lucide-react';
import './ErrorState.css';

interface ErrorStateProps {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`gxa-error-state ${className}`}>
      <div className="error-state-icon-wrap">
        <AlertCircle size={32} className="error-state-icon" />
      </div>
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-message">{message}</p>
      {details && (
        <details className="error-state-details">
          <summary>Technical Details</summary>
          <pre>{details}</pre>
        </details>
      )}
      {onRetry && (
        <button type="button" className="btn-secondary error-retry-btn" onClick={onRetry}>
          <RefreshCw size={16} /> Retry
        </button>
      )}
    </div>
  );
}
