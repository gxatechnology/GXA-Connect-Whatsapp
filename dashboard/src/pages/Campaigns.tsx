import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ListFilter, Loader2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useSessionsQuery } from '../hooks/queries';
import { messageApi, type CampaignBatchSummary, type BatchStatusResponse } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { CampaignBuilder } from '../components/campaigns/CampaignBuilder';
import { CampaignHistoryTable } from '../components/campaigns/CampaignHistoryTable';
import { LiveCampaignMonitor } from '../components/campaigns/LiveCampaignMonitor';
import { CampaignReportModal } from '../components/campaigns/CampaignReportModal';
import type { ParsedRecipient } from '../utils/campaignRecipients';
import './Campaigns.css';

export function Campaigns() {
  const { t } = useTranslation();
  useDocumentTitle(t('campaigns.title', 'Campaigns & Broadcasts'));
  const { error: showErrorToast, success: showSuccessToast } = useToast();

  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const readySessions = useMemo(() => allSessions.filter(s => s.status === 'ready'), [allSessions]);

  const [activeTab, setActiveTab] = useState<'history' | 'create'>('create');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Campaigns list state
  const [campaigns, setCampaigns] = useState<CampaignBatchSummary[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(false);

  // Active / in-flight batch for live monitor
  const [activeBatch, setActiveBatch] = useState<BatchStatusResponse | null>(null);
  const [activeBatchSessionId, setActiveBatchSessionId] = useState<string>('');
  const [cancellingBatch, setCancellingBatch] = useState<boolean>(false);

  // Drilldown Report Modal state
  const [selectedReportCampaign, setSelectedReportCampaign] = useState<CampaignBatchSummary | null>(null);

  // Prepopulated state for Retry Failed
  const [retryRecipients, setRetryRecipients] = useState<ParsedRecipient[] | undefined>(undefined);
  const [retryCampaignName, setRetryCampaignName] = useState<string | undefined>(undefined);

  // Set initial selected session
  useEffect(() => {
    if (!selectedSessionId && readySessions.length > 0) {
      setSelectedSessionId(readySessions[0].id);
    }
  }, [readySessions, selectedSessionId]);

  // Fetch campaigns for all ready sessions
  const fetchAllCampaigns = useCallback(async () => {
    if (readySessions.length === 0) {
      setCampaigns([]);
      return;
    }
    setLoadingCampaigns(true);
    try {
      const allResults = await Promise.all(
        readySessions.map(async s => {
          try {
            return await messageApi.listBatches(s.id, 100);
          } catch {
            return [];
          }
        }),
      );
      const combined = allResults.flat();
      // Sort newest first
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCampaigns(combined);

      // Check if any campaign is currently in progress
      const running = combined.find(c => c.status === 'pending' || c.status === 'processing');
      if (running && !activeBatch) {
        setActiveBatch(running);
        setActiveBatchSessionId(running.sessionId);
      }
    } finally {
      setLoadingCampaigns(false);
    }
  }, [readySessions, activeBatch]);

  useEffect(() => {
    void fetchAllCampaigns();
  }, [fetchAllCampaigns]);

  // Live polling for in-flight active batch
  useEffect(() => {
    if (!activeBatch || !activeBatchSessionId || ['completed', 'cancelled', 'failed'].includes(activeBatch.status)) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const fresh = await messageApi.getBatchStatus(activeBatchSessionId, activeBatch.batchId);
        setActiveBatch(fresh);

        // If newly finished, refresh history list
        if (['completed', 'cancelled', 'failed'].includes(fresh.status)) {
          void fetchAllCampaigns();
        }
      } catch {
        // Keep current state on transient errors
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [activeBatch?.batchId, activeBatch?.status, activeBatchSessionId, fetchAllCampaigns]);

  // Handle new campaign launched
  const handleCampaignLaunched = (batchId: string) => {
    const newBatch: BatchStatusResponse = {
      batchId,
      status: 'pending',
      progress: { total: 0, sent: 0, failed: 0, pending: 0, cancelled: 0 },
    };
    setActiveBatch(newBatch);
    setActiveBatchSessionId(selectedSessionId);
    setActiveTab('history');
    setRetryRecipients(undefined);
    setRetryCampaignName(undefined);
    void fetchAllCampaigns();
  };

  // Handle Cancel Active Batch
  const handleCancelBatch = async (sessionId?: string, batchId?: string) => {
    const sId = sessionId || activeBatchSessionId;
    const bId = batchId || activeBatch?.batchId;
    if (!sId || !bId) return;

    setCancellingBatch(true);
    try {
      const result = await messageApi.cancelBatch(sId, bId);
      if (activeBatch && activeBatch.batchId === bId) {
        setActiveBatch(result);
      }
      showSuccessToast(`Campaign batch ${bId} cancelled.`);
      void fetchAllCampaigns();
    } catch (err) {
      showErrorToast('Failed to cancel campaign', err instanceof Error ? err.message : undefined);
    } finally {
      setCancellingBatch(false);
    }
  };

  // Open detailed report modal
  const handleOpenReport = async (campaign: CampaignBatchSummary) => {
    try {
      const latest = await messageApi.getBatchStatus(campaign.sessionId, campaign.batchId);
      setSelectedReportCampaign({ ...campaign, ...latest });
    } catch {
      setSelectedReportCampaign(campaign);
    }
  };

  // Retry Failed flow
  const handleRetryFailed = (failedRecipients: ParsedRecipient[], originalCampaignName: string) => {
    setSelectedReportCampaign(null);
    setRetryRecipients(failedRecipients);
    setRetryCampaignName(`[Retry] ${originalCampaignName}`);
    setActiveTab('create');
  };

  if (loadingSessions && allSessions.length === 0) {
    return (
      <div className="campaigns-page-container">
        <PageHeader
          title="Campaigns"
          subtitle="Create, schedule, and track WhatsApp bulk broadcast campaigns with real-time delivery telemetry."
        />
        <div className="campaigns-loading-state">
          <Loader2 className="animate-spin text-primary" size={36} />
          <p>Connecting to WhatsApp accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="campaigns-page-container">
      <PageHeader
        title="Campaigns"
        subtitle="Create, schedule, and track WhatsApp bulk broadcast campaigns with real-time delivery telemetry."
        badge={
          campaigns.length > 0
            ? `${campaigns.length} ${campaigns.length === 1 ? 'Campaign' : 'Campaigns'}`
            : undefined
        }
      />

      {/* Sub-navigation tabs */}
      <div className="campaigns-tabs-bar">
        <button
          type="button"
          className={`campaigns-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <Plus size={16} /> Create Campaign
        </button>
        <button
          type="button"
          className={`campaigns-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <ListFilter size={16} /> My Campaigns & History ({campaigns.length})
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="campaigns-tab-content">
        {activeTab === 'create' && (
          <CampaignBuilder
            sessions={readySessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            onCampaignLaunched={handleCampaignLaunched}
            initialRecipients={retryRecipients}
            initialCampaignName={retryCampaignName}
          />
        )}

        {activeTab === 'history' && (
          <div className="campaigns-history-view">
            {/* In-flight Live Progress Monitor */}
            {activeBatch && (
              <LiveCampaignMonitor
                batch={activeBatch}
                sessionName={readySessions.find(s => s.id === activeBatchSessionId)?.name}
                onCancel={() => void handleCancelBatch()}
                cancelling={cancellingBatch}
              />
            )}

            {/* Comprehensive History Table */}
            <CampaignHistoryTable
              campaigns={campaigns}
              sessions={readySessions}
              loading={loadingCampaigns}
              onRefresh={() => void fetchAllCampaigns()}
              onOpenReport={handleOpenReport}
              onCancelCampaign={handleCancelBatch}
              onRetryFailed={handleRetryFailed}
              onCreateNewClick={() => setActiveTab('create')}
            />
          </div>
        )}
      </div>

      {/* Recipient-Level Drilldown Modal */}
      {selectedReportCampaign && (
        <CampaignReportModal
          campaign={selectedReportCampaign}
          sessionName={readySessions.find(s => s.id === selectedReportCampaign.sessionId)?.name}
          onClose={() => setSelectedReportCampaign(null)}
          onRetryFailed={handleRetryFailed}
        />
      )}
    </div>
  );
}
export default Campaigns;
