import { useState, useMemo } from 'react';
import { Download, Search, X, AlertCircle, CheckCircle2, XCircle, RotateCcw, Clock } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { downloadCsvReport, type ParsedRecipient } from '../../utils/campaignRecipients';
import type { CampaignBatchSummary, BatchMessageResult } from '../../services/api';
import './CampaignReportModal.css';

interface CampaignReportModalProps {
  campaign: CampaignBatchSummary;
  sessionName?: string;
  onClose: () => void;
  onRetryFailed?: (failedRecipients: ParsedRecipient[], originalCampaignName: string) => void;
}

export function CampaignReportModal({
  campaign,
  sessionName,
  onClose,
  onRetryFailed,
}: CampaignReportModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'pending' | 'cancelled'>('all');

  const results: BatchMessageResult[] = campaign.results || [];

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchSearch =
        !searchTerm ||
        r.chatId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.messageId && r.messageId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.error?.message && r.error.message.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'all' || r.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [results, searchTerm, statusFilter]);

  const failedItems = useMemo(() => results.filter(r => r.status === 'failed'), [results]);

  const handleExportFull = () => {
    const filename = `${(campaign.campaignName || campaign.batchId).replace(/[^a-z0-9-_]+/gi, '-')}-report.csv`;
    const rows = [
      ['Campaign Name', campaign.campaignName || 'Untitled Campaign'],
      ['Batch ID', campaign.batchId],
      ['Status', campaign.status],
      ['Total Recipients', String(campaign.progress.total)],
      ['Sent', String(campaign.progress.sent)],
      ['Failed', String(campaign.progress.failed)],
      ['Cancelled', String(campaign.progress.cancelled)],
      ['Created At', new Date(campaign.createdAt).toLocaleString()],
      [],
      ['Recipient (Chat ID)', 'Status', 'Message ID', 'Sent At', 'Error Code', 'Error Message'],
      ...results.map(r => [
        r.chatId,
        r.status,
        r.messageId || '',
        r.sentAt ? new Date(r.sentAt).toLocaleString() : '',
        r.error?.code || '',
        r.error?.message || '',
      ]),
    ];
    downloadCsvReport(filename, rows);
  };

  const handleExportFailedOnly = () => {
    const filename = `${(campaign.campaignName || campaign.batchId).replace(/[^a-z0-9-_]+/gi, '-')}-failed-only.csv`;
    const rows = [
      ['Campaign Name', campaign.campaignName || 'Untitled Campaign'],
      ['Batch ID', campaign.batchId],
      ['Report Type', 'Failed Recipients Only'],
      [],
      ['Recipient (Chat ID)', 'Status', 'Error Code', 'Error Message'],
      ...failedItems.map(r => [
        r.chatId,
        r.status,
        r.error?.code || '',
        r.error?.message || '',
      ]),
    ];
    downloadCsvReport(filename, rows);
  };

  const handleTriggerRetry = () => {
    if (!onRetryFailed || failedItems.length === 0) return;
    const retryRecipients: ParsedRecipient[] = failedItems.map(f => {
      const digits = f.chatId.split('@')[0];
      return {
        raw: digits,
        digits,
        chatId: f.chatId,
        variables: { phone: digits },
        validFormat: true,
        duplicate: false,
      };
    });
    onRetryFailed(retryRecipients, campaign.campaignName || campaign.batchId);
  };

  return (
    <div className="report-modal-backdrop" onMouseDown={onClose}>
      <div className="report-modal-dialog" onMouseDown={e => e.stopPropagation()}>
        <div className="report-modal-header">
          <div>
            <div className="report-title-row">
              <h2 className="report-title">{campaign.campaignName || 'Campaign Details'}</h2>
              <StatusBadge status={campaign.status} size="sm" />
            </div>
            <p className="report-subtitle">
              Batch ID: <code>{campaign.batchId}</code> • Account: <strong>{sessionName || campaign.sessionId}</strong>
            </p>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Progress summary bar */}
        <div className="report-stats-grid">
          <div className="report-stat-card">
            <span className="stat-label">Total Recipients</span>
            <span className="stat-value">{campaign.progress.total.toLocaleString()}</span>
          </div>
          <div className="report-stat-card ok">
            <span className="stat-label">Delivered / Sent</span>
            <span className="stat-value ok">{campaign.progress.sent.toLocaleString()}</span>
          </div>
          <div className="report-stat-card bad">
            <span className="stat-label">Failed</span>
            <span className="stat-value bad">{campaign.progress.failed.toLocaleString()}</span>
          </div>
          <div className="report-stat-card">
            <span className="stat-label">Pending / Cancelled</span>
            <span className="stat-value">
              {(campaign.progress.pending + campaign.progress.cancelled).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Filters and search */}
        <div className="report-toolbar">
          <div className="report-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by phone, message ID, or error..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button type="button" className="clear-search" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="report-status-pills">
            {(['all', 'sent', 'failed', 'pending', 'cancelled'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                className={`status-pill ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient results table */}
        <div className="report-table-container">
          {filteredResults.length === 0 ? (
            <div className="report-empty-state">
              <AlertCircle size={32} className="text-muted" />
              <p>No recipient records found matching the current search criteria.</p>
            </div>
          ) : (
            <table className="report-results-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Message ID</th>
                  <th>Timestamp</th>
                  <th>Error Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((row, idx) => (
                  <tr key={`${row.chatId}-${idx}`}>
                    <td>
                      <span className="recipient-phone-mono">+{row.chatId.split('@')[0]}</span>
                    </td>
                    <td>
                      <span className={`badge-pill-status ${row.status}`}>
                        {row.status === 'sent' && <CheckCircle2 size={12} />}
                        {row.status === 'failed' && <XCircle size={12} />}
                        {row.status === 'pending' && <Clock size={12} />}
                        {row.status}
                      </span>
                    </td>
                    <td>
                      {row.messageId ? (
                        <code className="msg-id-code" title={row.messageId}>
                          {row.messageId.slice(0, 16)}...
                        </code>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="time-text">
                        {row.sentAt ? new Date(row.sentAt).toLocaleTimeString() : '—'}
                      </span>
                    </td>
                    <td>
                      {row.error?.message ? (
                        <span className="error-text" title={row.error.message}>
                          {row.error.code ? `[${row.error.code}] ` : ''}
                          {row.error.message}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal actions footer */}
        <div className="report-modal-footer">
          <div className="left-actions">
            {failedItems.length > 0 && onRetryFailed && (
              <button type="button" className="btn-secondary retry-btn" onClick={handleTriggerRetry}>
                <RotateCcw size={15} /> Retry Failed ({failedItems.length})
              </button>
            )}
          </div>
          <div className="right-actions">
            {failedItems.length > 0 && (
              <button type="button" className="btn-secondary" onClick={handleExportFailedOnly}>
                <Download size={15} /> Export Failed Only
              </button>
            )}
            <button type="button" className="btn-primary" onClick={handleExportFull}>
              <Download size={15} /> Download Full CSV Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
