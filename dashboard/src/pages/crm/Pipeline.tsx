import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Columns,
  Phone,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import {
  useCrmLeadsQuery,
  useUpdateLeadMutation,
  useUsersQuery,
} from '../../hooks/queries';
import { LeadDetailDrawer } from '../../components/crm/LeadDetailDrawer';
import type { CrmLead } from '../../services/api';
import './Pipeline.css';

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'] as const;

export function Pipeline() {
  const navigate = useNavigate();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data, isLoading } = useCrmLeadsQuery({ limit: 200 });
  const { data: users = [] } = useUsersQuery();
  const updateLeadMutation = useUpdateLeadMutation();

  const leads = data?.leads || [];

  const handleStageChange = (leadId: string, nextStage: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    updateLeadMutation.mutate({
      id: leadId,
      body: { stage: nextStage as CrmLead['stage'] },
    });
  };

  const handleOpenChat = (leadPhone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/chats?contact=${encodeURIComponent(leadPhone)}`);
  };

  return (
    <div className="crm-pipeline-page">
      <div className="pipeline-header">
        <div className="pipeline-title-group">
          <Columns size={24} color="var(--gxa-blue, #0B4DBB)" />
          <h1 className="pipeline-title">Lead Pipeline</h1>
        </div>
        <div>
          <button
            className="action-icon-btn"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}
            onClick={() => navigate('/crm/leads')}
          >
            Switch to Leads Table
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Loader2 className="animate-spin" size={32} color="var(--gxa-blue)" />
        </div>
      ) : (
        <div className="pipeline-board">
          {STAGES.map(stageName => {
            const stageLeads = leads.filter(l => l.stage === stageName);
            return (
              <div key={stageName} className="stage-column">
                <div className="column-header">
                  <span className="column-title">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor:
                          stageName === 'New'
                            ? '#0284c7'
                            : stageName === 'Contacted'
                            ? '#d97706'
                            : stageName === 'Qualified'
                            ? '#4338ca'
                            : stageName === 'Proposal'
                            ? '#a21caf'
                            : stageName === 'Won'
                            ? '#15803d'
                            : '#b91c1c',
                      }}
                    />
                    {stageName}
                  </span>
                  <span className="column-count">{stageLeads.length}</span>
                </div>

                <div className="column-cards">
                  {stageLeads.length === 0 ? (
                    <div className="empty-column-card">No leads in {stageName}</div>
                  ) : (
                    stageLeads.map(lead => {
                      const assignee = users.find(u => u.id === lead.assignedUserId);
                      return (
                        <div
                          key={lead.id}
                          className="lead-card"
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <div className="card-top">
                            <div>
                              <h4 className="card-name">{lead.name}</h4>
                              {lead.company && <p className="card-company">{lead.company}</p>}
                            </div>
                            <button
                              className="action-icon-btn"
                              title="Chat on WhatsApp"
                              onClick={e => handleOpenChat(lead.phone, e)}
                            >
                              <MessageSquare size={13} color="#25D366" />
                            </button>
                          </div>

                          <div className="card-phone">
                            <Phone size={12} /> {lead.phone}
                          </div>

                          {lead.tags && lead.tags.length > 0 && (
                            <div className="card-tags">
                              {lead.tags.map(t => (
                                <span
                                  key={t.id}
                                  className="card-tag-pill"
                                  style={{
                                    backgroundColor: `${t.color || '#0B4DBB'}20`,
                                    color: t.color || '#0B4DBB',
                                  }}
                                >
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="card-footer">
                            <span className="card-agent">
                              {assignee ? assignee.fullName : 'Unassigned'}
                            </span>
                            <div className="card-stage-mover" onClick={e => e.stopPropagation()}>
                              <select
                                className="mover-select"
                                value={lead.stage}
                                onChange={e => handleStageChange(lead.id, e.target.value, e)}
                              >
                                {STAGES.map(s => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead Detail Drawer */}
      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}
