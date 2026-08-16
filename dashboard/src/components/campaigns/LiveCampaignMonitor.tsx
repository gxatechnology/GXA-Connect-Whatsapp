import { Loader2, PauseCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import type { BatchStatusResponse } from '../../services/api';
import './LiveCampaignMonitor.css';

interface LiveCampaignMonitorProps {
  batch: BatchStatusResponse;
  sessionName?: string;
  onCancel: () => void;
  cancelling?: boolean;
}

export function LiveCampaignMonitor({
  batch,
  sessionName,
  onCancel,
  cancelling = false,
}: LiveCampaignMonitorProps) {
  const { total, sent, failed, pending, cancelled } = batch.progress;
  const processed = sent + failed + cancelled;
  const progressPercent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const isRunning = batch.status === 'pending' || batch.status === 'processing';

  return (
    <div className={`live-monitor-card ${isRunning ? 'is-running' : ''}`}>
      <div className="live-monitor-top">
        <div className="monitor-heading">
          <div className="monitor-status-row">
            {isRunning && <span className="pulsing-dot" />}
            <span className="monitor-title">Live Dispatch Monitor</span>
            <StatusBadge status={batch.status} size="sm" />
          </div>
          <p className="monitor-meta">
            Batch: <code>{batch.batchId}</code> • Account: <strong>{sessionName || 'Active Account'}</strong>
          </p>
        </div>

        {isRunning && (
          <button
            type="button"
            className="btn-cancel-campaign"
            onClick={onCancel}
            disabled={cancelling}
            title="Stop processing remaining queued messages"
          >
            {cancelling ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Stopping...
              </>
            ) : (
              <>
                <PauseCircle size={15} /> Cancel Campaign
              </>
            )}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="monitor-progress-section">
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-percentage-row">
          <span>
            {processed} of {total} messages processed
          </span>
          <span className="progress-percent-number">{progressPercent}%</span>
        </div>
      </div>

      {/* Real-time counters */}
      <div className="monitor-counters-grid">
        <div className="monitor-counter-box">
          <span className="counter-label">Total</span>
          <span className="counter-val">{total}</span>
        </div>
        <div className="monitor-counter-box ok">
          <span className="counter-label">
            <CheckCircle2 size={13} /> Sent
          </span>
          <span className="counter-val ok">{sent}</span>
        </div>
        <div className="monitor-counter-box bad">
          <span className="counter-label">
            <XCircle size={13} /> Failed
          </span>
          <span className="counter-val bad">{failed}</span>
        </div>
        <div className="monitor-counter-box">
          <span className="counter-label">
            <Clock size={13} /> Queued
          </span>
          <span className="counter-val">{pending}</span>
        </div>
      </div>
    </div>
  );
}
