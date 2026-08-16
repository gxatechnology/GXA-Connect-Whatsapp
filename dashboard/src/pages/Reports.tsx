import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessageSquare, RefreshCw, Send, XCircle, BarChart3, AlertCircle } from 'lucide-react';
import { useSessionsQuery, useStatsOverviewQuery } from '../hooks/queries';
import { messageApi, type CampaignBatchSummary } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { StatCard, StatusBadge, EmptyState, LoadingState } from '../components/common';
import './Reports.css';

export function Reports() {
  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const ready = sessions.filter(s => s.status === 'ready');
  const [sessionId, setSessionId] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignBatchSummary[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const { data: overview } = useStatsOverviewQuery();

  useEffect(() => {
    if (!sessionId && ready[0]) setSessionId(ready[0].id);
  }, [ready, sessionId]);

  const load = async () => {
    if (!sessionId) return;
    setLoadingCampaigns(true);
    try {
      setCampaigns(await messageApi.listBatches(sessionId, 250));
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const totals = useMemo(
    () =>
      campaigns.reduce(
        (a, c) => {
          a.total += c.progress?.total || 0;
          a.sent += c.progress?.sent || 0;
          a.failed += c.progress?.failed || 0;
          a.pending += c.progress?.pending || 0;
          return a;
        },
        { total: 0, sent: 0, failed: 0, pending: 0 },
      ),
    [campaigns],
  );

  if (loadingSessions) {
    return <LoadingState message="Loading accounts report..." minHeight="360px" />;
  }

  return (
    <div className="reports-container">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Live reporting calculated strictly from stored message logs and real campaign batches."
        actions={
          <div className="reports-header-actions">
            <select
              className="reports-session-select"
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
            >
              {ready.length === 0 && <option value="">No connected account</option>}
              {ready.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.phone ? `(${s.phone})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              onClick={load}
              disabled={loadingCampaigns || !sessionId}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="reports-kpi-grid">
        <StatCard label="Campaign Batches" value={campaigns.length} icon={MessageSquare} />
        <StatCard label="Recipients Target" value={totals.total} icon={Send} />
        <StatCard label="Delivered Messages" value={totals.sent} icon={CheckCircle2} />
        <StatCard label="Failed Messages" value={totals.failed} icon={XCircle} />
      </div>

      <div className="reports-sections-grid">
        {/* Real Message Traffic Overview */}
        <div className="reports-card">
          <h2 className="reports-card-title">Message Traffic Overview</h2>
          {overview ? (
            <div className="real-metrics-grid">
              <div className="metric-box">
                <span className="metric-box-label">Today Sent</span>
                <strong className="metric-box-val">{overview.messages.today.sent.toLocaleString()}</strong>
              </div>
              <div className="metric-box">
                <span className="metric-box-label">Today Received</span>
                <strong className="metric-box-val">{overview.messages.today.received.toLocaleString()}</strong>
              </div>
              <div className="metric-box">
                <span className="metric-box-label">Total Sent</span>
                <strong className="metric-box-val">{overview.messages.sent.toLocaleString()}</strong>
              </div>
              <div className="metric-box">
                <span className="metric-box-label">Total Received</span>
                <strong className="metric-box-val">{overview.messages.received.toLocaleString()}</strong>
              </div>
            </div>
          ) : (
            <div className="reports-empty-msg">
              <AlertCircle size={20} />
              <span>Message aggregate statistics require an administrative API key.</span>
            </div>
          )}
        </div>

        {/* Campaign Status Breakdown */}
        <div className="reports-card">
          <h2 className="reports-card-title">Campaign Status Breakdown</h2>
          {loadingCampaigns ? (
            <LoadingState minHeight="140px" message="Aggregating campaigns..." />
          ) : campaigns.length === 0 ? (
            <div className="reports-empty-msg">No campaign batches recorded for this WhatsApp account.</div>
          ) : (
            <div className="status-breakdown-list">
              {(['completed', 'processing', 'pending', 'failed', 'cancelled'] as const).map(status => {
                const count = campaigns.filter(c => c.status === status).length;
                return (
                  <div key={status} className="status-row">
                    <StatusBadge status={status} size="sm" />
                    <strong className="status-count">{count}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Campaign Batches Table */}
      <section className="reports-card">
        <h2 className="reports-card-title">Recent Campaign Batches</h2>
        {loadingCampaigns ? (
          <LoadingState minHeight="180px" message="Loading campaign records..." />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No Campaigns Sent Yet"
            description="Campaign delivery metrics and recipient breakdowns will appear here after launching your first campaign."
          />
        ) : (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Campaign Name / ID</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 25).map(c => (
                  <tr key={c.batchId}>
                    <td>
                      <div className="campaign-name-cell">
                        <strong>{c.campaignName || 'Untitled campaign'}</strong>
                        <span className="mono muted-text">{c.batchId}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={c.status} size="sm" />
                    </td>
                    <td>{c.progress?.total || 0}</td>
                    <td>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>{c.progress?.sent || 0}</span>
                    </td>
                    <td>
                      <span style={{ color: c.progress?.failed ? '#dc2626' : 'inherit' }}>
                        {c.progress?.failed || 0}
                      </span>
                    </td>
                    <td>{new Date(c.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
