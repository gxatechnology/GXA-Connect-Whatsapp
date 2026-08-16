import { useState, useMemo } from 'react';
import { Download, Eye, RotateCcw, Search, X, Loader2, Megaphone, Plus, PauseCircle } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { downloadCsvReport, type ParsedRecipient } from '../../utils/campaignRecipients';
import type { CampaignBatchSummary, Session } from '../../services/api';
import './CampaignHistoryTable.css';

interface CampaignHistoryTableProps {
  campaigns: CampaignBatchSummary[];
  sessions: Session[];
  loading: boolean;
  onRefresh: () => void;
  onOpenReport: (campaign: CampaignBatchSummary) => void;
  onCancelCampaign?: (sessionId: string, batchId: string) => void;
  onRetryFailed?: (failedRecipients: ParsedRecipient[], originalCampaignName: string) => void;
  onCreateNewClick?: () => void;
}

export function CampaignHistoryTable({
  campaigns,
  sessions,
  loading,
  onRefresh,
  onOpenReport,
  onCancelCampaign,
  onRetryFailed,
  onCreateNewClick,
}: CampaignHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<string>('all');

  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    sessions.forEach(s => map.set(s.id, s));
    return map;
  }, [sessions]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchSearch =
        !searchTerm ||
        (c.campaignName && c.campaignName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        c.batchId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchSession = sessionFilter === 'all' || c.sessionId === sessionFilter;

      return matchSearch && matchStatus && matchSession;
    });
  }, [campaigns, searchTerm, statusFilter, sessionFilter]);

  const handleExportCsv = (c: CampaignBatchSummary) => {
    const filename = `${(c.campaignName || c.batchId).replace(/[^a-z0-9-_]+/gi, '-')}-report.csv`;
    const results = c.results || [];
    const rows = [
      ['Campaign Name', c.campaignName || 'Untitled Campaign'],
      ['Batch ID', c.batchId],
      ['Status', c.status],
      ['Total', String(c.progress.total)],
      ['Sent', String(c.progress.sent)],
      ['Failed', String(c.progress.failed)],
      ['Created At', new Date(c.createdAt).toLocaleString()],
      [],
      ['Recipient', 'Status', 'Message ID', 'Sent At', 'Error Code', 'Error Message'],
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

  const handleRetryFailed = (c: CampaignBatchSummary) => {
    if (!onRetryFailed) return;
    const failed = (c.results || []).filter(r => r.status === 'failed');
    if (failed.length === 0) return;

    const retryRecipients: ParsedRecipient[] = failed.map(f => {
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
    onRetryFailed(retryRecipients, c.campaignName || c.batchId);
  };

  return (
    <div className="campaign-history-container">
      {/* Header controls bar */}
      <div className="campaign-table-toolbar">
        <div className="search-filter-group">
          <div className="table-search-input">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by campaign name or batch ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button type="button" className="clear-btn" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="table-filter-select"
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
          >
            <option value="all">All WhatsApp Accounts</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.phone || 'No phone'})
              </option>
            ))}
          </select>

          <select
            className="table-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <button type="button" className="btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {/* Main Table or Empty State */}
      {loading && campaigns.length === 0 ? (
        <div className="table-loading-box">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading campaign history...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No Campaigns Created Yet"
          description="Create your first WhatsApp bulk broadcast campaign to reach your audience with real-time delivery tracking."
          action={
            onCreateNewClick ? (
              <button type="button" className="btn-primary" onClick={onCreateNewClick}>
                <Plus size={16} /> Create Campaign
              </button>
            ) : undefined
          }
        />
      ) : filteredCampaigns.length === 0 ? (
        <div className="table-no-results">
          <p>No campaigns match the current filter criteria.</p>
        </div>
      ) : (
        <div className="campaign-table-wrapper">
          <table className="campaigns-data-table">
            <thead>
              <tr>
                <th>Campaign Details</th>
                <th>WhatsApp Account</th>
                <th>Status</th>
                <th>Progress & Sent</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map(c => {
                const session = sessionMap.get(c.sessionId);
                const { total, sent, failed, cancelled } = c.progress;
                const processed = sent + failed + cancelled;
                const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
                const isRunning = c.status === 'pending' || c.status === 'processing';

                return (
                  <tr key={c.batchId}>
                    <td>
                      <div className="campaign-name-cell">
                        <strong className="campaign-main-name">{c.campaignName || 'Untitled Campaign'}</strong>
                        <span className="batch-id-tag mono">{c.batchId}</span>
                      </div>
                    </td>
                    <td>
                      <div className="account-cell">
                        <span className="account-name">{session?.name || c.sessionId}</span>
                        {session?.phone && <span className="account-phone mono">+{session.phone}</span>}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={c.status} size="sm" />
                    </td>
                    <td>
                      <div className="progress-cell">
                        <div className="mini-progress-track">
                          <div
                            className={`mini-progress-fill ${c.status === 'failed' ? 'bad' : ''}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="progress-meta-text">
                          <span>
                            <strong>{sent}</strong> / {total} sent
                          </span>
                          {failed > 0 && <span className="failed-count">({failed} failed)</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="date-text">{new Date(c.createdAt).toLocaleString()}</span>
                    </td>
                    <td>
                      <div className="campaign-row-actions">
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => onOpenReport(c)}
                          title="View detailed recipient report"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => handleExportCsv(c)}
                          title="Download CSV report"
                        >
                          <Download size={16} />
                        </button>

                        {failed > 0 && onRetryFailed && (
                          <button
                            type="button"
                            className="btn-action-icon retry"
                            onClick={() => handleRetryFailed(c)}
                            title={`Retry ${failed} failed recipients`}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}

                        {isRunning && onCancelCampaign && (
                          <button
                            type="button"
                            className="btn-action-icon danger"
                            onClick={() => onCancelCampaign(c.sessionId, c.batchId)}
                            title="Cancel running campaign"
                          >
                            <PauseCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
