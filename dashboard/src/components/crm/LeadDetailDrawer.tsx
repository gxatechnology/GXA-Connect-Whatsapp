import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  User as UserIcon,
  Phone,
  Mail,
  Building,
  Tag,
  FileText,
  Clock,
  History,
  Send,
  MessageSquare,
  Plus,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import {
  useCrmLeadQuery,
  useUpdateLeadMutation,
  useCrmNotesQuery,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useCrmTagsQuery,
  useAddTagToLeadMutation,
  useRemoveTagFromLeadMutation,
  useCrmFollowupsQuery,
  useCreateFollowupMutation,
  useUpdateFollowupMutation,
  useCrmActivityQuery,
  useCrmCampaignHistoryQuery,
  useUsersQuery,
} from '../../hooks/queries';
import type { CrmLead } from '../../services/api';
import './LeadDetailDrawer.css';

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
}

type TabType = 'overview' | 'notes' | 'followups' | 'campaigns' | 'activity';

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

export function LeadDetailDrawer({ leadId, onClose }: LeadDetailDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [newNote, setNewNote] = useState('');
  const [newTagId, setNewTagId] = useState('');
  const [showAddFollowup, setShowAddFollowup] = useState(false);
  const [followupTitle, setFollowupTitle] = useState('');
  const [followupDueAt, setFollowupDueAt] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');

  const { data: lead, isLoading } = useCrmLeadQuery(leadId || '', !!leadId);
  const { data: notes = [] } = useCrmNotesQuery(leadId || '', !!leadId && activeTab === 'notes');
  const { data: allTags = [] } = useCrmTagsQuery();
  const { data: followupsData } = useCrmFollowupsQuery({
    leadId: leadId || undefined,
    view: 'all',
  });
  const followups = followupsData?.followups || [];
  const { data: activity = [] } = useCrmActivityQuery(
    leadId || '',
    !!leadId && activeTab === 'activity',
  );
  const { data: campaignHistory = [] } = useCrmCampaignHistoryQuery(
    leadId || '',
    !!leadId && activeTab === 'campaigns',
  );
  const { data: users = [] } = useUsersQuery();

  const updateLeadMutation = useUpdateLeadMutation();
  const createNoteMutation = useCreateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation(leadId || '');
  const addTagMutation = useAddTagToLeadMutation();
  const removeTagMutation = useRemoveTagFromLeadMutation();
  const createFollowupMutation = useCreateFollowupMutation();
  const updateFollowupMutation = useUpdateFollowupMutation();

  if (!leadId) return null;

  const handleStageChange = (newStage: string) => {
    if (!lead) return;
    updateLeadMutation.mutate({
      id: lead.id,
      body: { stage: newStage as CrmLead['stage'] },
    });
  };

  const handleAssigneeChange = (assignedUserId: string) => {
    if (!lead) return;
    updateLeadMutation.mutate({
      id: lead.id,
      body: { assignedUserId: assignedUserId || null },
    });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !leadId) return;
    createNoteMutation.mutate(
      { leadId, content: newNote.trim() },
      {
        onSuccess: () => setNewNote(''),
      },
    );
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagId || !leadId) return;
    addTagMutation.mutate(
      { leadId, tagId: newTagId },
      {
        onSuccess: () => setNewTagId(''),
      },
    );
  };

  const handleCreateFollowup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupTitle.trim() || !followupDueAt || !leadId) return;
    createFollowupMutation.mutate(
      {
        leadId,
        title: followupTitle.trim(),
        dueAt: new Date(followupDueAt).toISOString(),
        notes: followupNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowAddFollowup(false);
          setFollowupTitle('');
          setFollowupDueAt('');
          setFollowupNotes('');
        },
      },
    );
  };

  const handleToggleFollowupStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    updateFollowupMutation.mutate({
      id,
      body: { status: nextStatus },
    });
  };

  const handleOpenWhatsAppChat = () => {
    if (!lead?.phone) return;
    onClose();
    navigate(`/chats?contact=${encodeURIComponent(lead.phone)}`);
  };

  return (
    <div className="lead-detail-drawer-overlay" onClick={onClose}>
      <div className="lead-detail-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title-area">
            <h2 className="drawer-lead-name">
              <UserIcon size={20} color="var(--gxa-blue, #0B4DBB)" />
              {lead?.name || 'Loading lead...'}
            </h2>
            {lead?.company && <p className="drawer-lead-company"><Building size={14} style={{ display: 'inline', marginRight: 4 }} />{lead.company}</p>}
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close drawer">
            <X size={20} />
          </button>
        </div>

        {/* Meta Bar: Stage & Assignment */}
        {lead && (
          <div className="drawer-meta-bar">
            <div className="stage-select-group">
              <span className="meta-label">Stage:</span>
              <select
                className="meta-select"
                value={lead.stage}
                onChange={e => handleStageChange(e.target.value)}
              >
                {STAGES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="assigned-select-group">
              <span className="meta-label">Assigned:</span>
              <select
                className="meta-select"
                value={lead.assignedUserId || ''}
                onChange={e => handleAssigneeChange(e.target.value)}
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="drawer-tabs">
          <button
            className={`drawer-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <UserIcon size={15} /> Overview
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <FileText size={15} /> Notes
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            <Clock size={15} /> Follow-ups
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            <Send size={15} /> Campaigns
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <History size={15} /> Activity
          </button>
        </div>

        {/* Drawer Content */}
        <div className="drawer-content">
          {isLoading && <div className="empty-state-card">Loading lead details...</div>}

          {!isLoading && lead && (
            <>
              {activeTab === 'overview' && (
                <>
                  <div className="section-card">
                    <h3 className="section-title">Contact Information</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Phone Number</span>
                        <span className="info-val">
                          <Phone size={13} style={{ display: 'inline', marginRight: 4 }} />
                          {lead.phone}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Email</span>
                        <span className="info-val">
                          {lead.email ? (
                            <>
                              <Mail size={13} style={{ display: 'inline', marginRight: 4 }} />
                              {lead.email}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>None</span>
                          )}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Company</span>
                        <span className="info-val">{lead.company || '—'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Lead Source</span>
                        <span className="info-val">{lead.source}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Created At</span>
                        <span className="info-val">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Next Follow-up</span>
                        <span className="info-val">
                          {lead.nextFollowUpAt
                            ? new Date(lead.nextFollowUpAt).toLocaleString()
                            : 'None scheduled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="section-card">
                    <h3 className="section-title">
                      <span><Tag size={15} style={{ display: 'inline', marginRight: 6 }} /> Tags</span>
                    </h3>
                    <div className="tag-chips">
                      {lead.tags && lead.tags.length > 0 ? (
                        lead.tags.map(t => (
                          <span
                            key={t.id}
                            className="tag-chip"
                            style={{
                              backgroundColor: `${t.color || '#0B4DBB'}20`,
                              color: t.color || '#0B4DBB',
                              border: `1px solid ${t.color || '#0B4DBB'}40`,
                            }}
                          >
                            {t.name}
                            <button
                              className="tag-remove-btn"
                              onClick={() => removeTagMutation.mutate({ leadId: lead.id, tagId: t.id })}
                              title="Remove tag"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          No tags assigned
                        </span>
                      )}
                    </div>

                    <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        className="meta-select"
                        value={newTagId}
                        onChange={e => setNewTagId(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select a tag to add...</option>
                        {allTags
                          .filter(t => !lead.tags?.some(lt => lt.id === t.id))
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={!newTagId}
                      >
                        <Plus size={14} /> Add Tag
                      </button>
                    </form>
                  </div>
                </>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="section-card">
                  <h3 className="section-title">Internal Notes</h3>
                  <form onSubmit={handleAddNote} className="add-note-form">
                    <textarea
                      className="form-textarea"
                      placeholder="Add an internal note about this lead..."
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      rows={3}
                    />
                    <button type="submit" className="btn-primary" disabled={!newNote.trim()}>
                      <Plus size={14} /> Add Note
                    </button>
                  </form>

                  <div className="notes-list" style={{ marginTop: '1rem' }}>
                    {notes.length === 0 ? (
                      <div className="empty-state-card">No notes recorded yet.</div>
                    ) : (
                      notes.map(note => (
                        <div key={note.id} className="note-item">
                          <div className="item-header">
                            <span className="item-author">{note.authorName || 'Staff'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{new Date(note.createdAt).toLocaleString()}</span>
                              <button
                                type="button"
                                className="tag-remove-btn"
                                title="Delete note"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="item-body">{note.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Followups Tab */}
              {activeTab === 'followups' && (
                <div className="section-card">
                  <div className="section-title">
                    <span>Scheduled Follow-ups</span>
                    <button
                      className="btn-primary"
                      onClick={() => setShowAddFollowup(!showAddFollowup)}
                    >
                      <Plus size={14} /> {showAddFollowup ? 'Cancel' : 'Schedule Follow-up'}
                    </button>
                  </div>

                  {showAddFollowup && (
                    <form onSubmit={handleCreateFollowup} className="add-followup-form">
                      <input
                        type="text"
                        className="meta-select"
                        placeholder="Follow-up title (e.g. Call client about proposal)..."
                        value={followupTitle}
                        onChange={e => setFollowupTitle(e.target.value)}
                        required
                      />
                      <input
                        type="datetime-local"
                        className="meta-select"
                        value={followupDueAt}
                        onChange={e => setFollowupDueAt(e.target.value)}
                        required
                      />
                      <textarea
                        className="form-textarea"
                        placeholder="Additional notes (optional)..."
                        value={followupNotes}
                        onChange={e => setFollowupNotes(e.target.value)}
                        rows={2}
                      />
                      <button type="submit" className="btn-primary" disabled={!followupTitle || !followupDueAt}>
                        Save Follow-up
                      </button>
                    </form>
                  )}

                  <div className="followups-list" style={{ marginTop: '1rem' }}>
                    {followups.length === 0 ? (
                      <div className="empty-state-card">No follow-ups scheduled for this lead.</div>
                    ) : (
                      followups.map(fu => (
                        <div key={fu.id} className="followup-item">
                          <div className="item-header">
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {fu.title}
                            </span>
                            <span
                              style={{
                                color: fu.status === 'Completed' ? 'var(--success-color, #10b981)' : 'var(--warning-color, #f59e0b)',
                                fontWeight: 600,
                              }}
                            >
                              {fu.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            Due: {new Date(fu.dueAt).toLocaleString()}
                          </div>
                          {fu.notes && <div className="item-body" style={{ marginTop: '0.25rem' }}>{fu.notes}</div>}
                          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-primary"
                              onClick={() => handleToggleFollowupStatus(fu.id, fu.status)}
                              style={{
                                background: fu.status === 'Completed' ? 'var(--text-secondary, #64748b)' : 'var(--gxa-blue, #0B4DBB)',
                              }}
                            >
                              <CheckCircle size={13} /> {fu.status === 'Completed' ? 'Reopen' : 'Mark Completed'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Campaigns Tab */}
              {activeTab === 'campaigns' && (
                <div className="section-card">
                  <h3 className="section-title">Campaign Broadcast History</h3>
                  <div className="campaign-history-list">
                    {campaignHistory.length === 0 ? (
                      <div className="empty-state-card">No campaign dispatches recorded for this contact.</div>
                    ) : (
                      campaignHistory.map((ch, idx) => (
                        <div key={idx} className="campaign-item">
                          <div className="item-header">
                            <span className="item-author">{ch.campaignName}</span>
                            <span
                              style={{
                                color: ch.status === 'sent' ? '#10b981' : (ch.status === 'failed' ? '#ef4444' : '#64748b'),
                                fontWeight: 600,
                              }}
                            >
                              {ch.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            Dispatched: {ch.sentAt ? new Date(ch.sentAt).toLocaleString() : 'Pending'}
                          </div>
                          {ch.error && (
                            <div style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                              <AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />
                              {ch.error}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="section-card">
                  <h3 className="section-title">Activity Audit Timeline</h3>
                  <div className="activity-list">
                    {activity.length === 0 ? (
                      <div className="empty-state-card">No activity records logged yet.</div>
                    ) : (
                      activity.map(act => (
                        <div key={act.id} className="activity-item">
                          <div className="item-header">
                            <span className="item-author">{act.actorName || 'System'}</span>
                            <span>{new Date(act.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="item-body">
                            <strong>{act.type.replace(/_/g, ' ')}</strong>
                            {act.metadata && (
                              <pre style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.85 }}>
                                {JSON.stringify(act.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Chat Quick Action */}
        <div className="drawer-footer">
          <button className="btn-primary" onClick={handleOpenWhatsAppChat} style={{ background: '#25D366' }}>
            <MessageSquare size={16} /> Open WhatsApp Chat
          </button>
          <button className="btn-primary" onClick={onClose} style={{ background: 'var(--bg-tertiary, #64748b)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
