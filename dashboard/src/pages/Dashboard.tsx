import { Suspense } from 'react';
import { lazyWithRetry as lazy } from '../utils/lazyWithRetry';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { MessageSquare, Send, Webhook, Smartphone, Plus, ArrowRight } from 'lucide-react';
import {
  useSessionsQuery,
  useSessionStatsQuery,
  useWebhooksQuery,
  useStatsOverviewQuery,
} from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { StatCard, StatusBadge, EmptyState, ErrorState, LoadingState } from '../components/common';
import './Dashboard.css';

// Recharts analytics section loaded on demand
const DashboardCharts = lazy(() => import('../components/DashboardCharts').then(m => ({ default: m.DashboardCharts })));

export function Dashboard() {
  const { t } = useTranslation();
  useDocumentTitle('GXA Connect — Dashboard');
  const navigate = useNavigate();

  const { data: sessions = [], isLoading: loadingSessions, error: sessionsError, refetch: refetchSessions } = useSessionsQuery();
  const { data: stats } = useSessionStatsQuery();
  const { data: webhooks = [] } = useWebhooksQuery();
  // /stats/overview is admin-gated; non-admin falls back gracefully without breaking the view
  const { data: overview } = useStatsOverviewQuery();

  const readyAccounts = stats?.ready ?? 0;
  const messagesToday = overview ? overview.messages.today.sent + overview.messages.today.received : '—';
  const totalMessages = overview ? overview.messages.sent + overview.messages.received : '—';

  const formatLastActive = (date?: string | null) => {
    if (!date) return t('common.never', { defaultValue: 'Never' });
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow', { defaultValue: 'Just now' });
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000), defaultValue: `${Math.floor(diff / 60000)}m ago` });
    if (diff < 86400000) return t('common.hoursAgo', { count: Math.floor(diff / 3600000), defaultValue: `${Math.floor(diff / 3600000)}h ago` });
    return new Date(date).toLocaleDateString();
  };

  if (loadingSessions) {
    return <LoadingState message="Loading dashboard metrics..." minHeight="400px" />;
  }

  if (sessionsError) {
    return (
      <div className="dashboard-container">
        <ErrorState
          title="Failed to load dashboard data"
          message={sessionsError instanceof Error ? sessionsError.message : 'Unable to connect to the WhatsApp API server.'}
          onRetry={() => void refetchSessions()}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Dashboard"
        subtitle="Operational overview of connected WhatsApp accounts, message traffic, and automation."
        badge={
          <StatusBadge
            status={readyAccounts > 0 ? 'connected' : 'disconnected'}
            label={readyAccounts > 0 ? `${readyAccounts} Active Account${readyAccounts > 1 ? 's' : ''}` : 'No Connected Account'}
          />
        }
        actions={
          <button type="button" className="btn-primary" onClick={() => navigate('/sessions')}>
            <Plus size={16} /> Connect Account
          </button>
        }
      />

      {/* Primary Real-Data Metrics */}
      <div className="dashboard-stats-grid">
        <StatCard
          label="WhatsApp Accounts"
          value={readyAccounts}
          icon={Smartphone}
          detail={stats ? `${stats.active} running · ${stats.total} total` : '0 registered'}
          onClick={() => navigate('/sessions')}
        />
        <StatCard
          label="Messages Today"
          value={messagesToday}
          icon={Send}
          detail={
            overview
              ? `${overview.messages.today.sent.toLocaleString()} sent · ${overview.messages.today.received.toLocaleString()} received`
              : 'Real message counts'
          }
        />
        <StatCard
          label="Total Message Volume"
          value={totalMessages}
          icon={MessageSquare}
          detail={
            overview
              ? `${overview.messages.sent.toLocaleString()} sent · ${overview.messages.received.toLocaleString()} received`
              : 'Lifetime processed'
          }
        />
        <StatCard
          label="Configured Webhooks"
          value={webhooks.length}
          icon={Webhook}
          detail="Real-time HTTP callbacks"
          onClick={() => navigate('/webhooks')}
        />
      </div>

      {/* Real Message Analytics Section */}
      <Suspense fallback={<LoadingState message="Loading message analytics..." minHeight="280px" />}>
        <DashboardCharts />
      </Suspense>

      {/* Connected WhatsApp Accounts Overview */}
      <section className="dashboard-sessions-card">
        <div className="card-section-header">
          <div>
            <h2 className="card-section-title">WhatsApp Accounts Overview</h2>
            <p className="card-section-subtitle">
              Showing {sessions.length} registered account{sessions.length === 1 ? '' : 's'}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => navigate('/sessions')}>
            Manage Accounts <ArrowRight size={15} />
          </button>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No WhatsApp Accounts Connected"
            description="Link your WhatsApp account using a quick QR code scan to enable chats, automated campaigns, and message delivery."
            action={
              <button type="button" className="btn-primary" onClick={() => navigate('/sessions')}>
                <Plus size={16} /> Add WhatsApp Account
              </button>
            }
          />
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Account / ID</th>
                  <th>Phone Number</th>
                  <th>Status</th>
                  <th>Last Active</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session.id}>
                    <td>
                      <div className="session-cell">
                        <strong className="session-title">{session.name || 'WhatsApp Session'}</strong>
                        <span className="session-sub mono">{session.id}</span>
                      </div>
                    </td>
                    <td>
                      <span className="phone-text">{session.phone || '—'}</span>
                    </td>
                    <td>
                      <StatusBadge status={session.status} size="sm" />
                    </td>
                    <td>
                      <span className="last-active-text">{formatLastActive(session.lastActive)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-sm-action"
                        onClick={() => navigate('/sessions')}
                      >
                        View Account
                      </button>
                    </td>
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
