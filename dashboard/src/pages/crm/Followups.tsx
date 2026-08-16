import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Plus,
  CheckCircle,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Eye,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import {
  useCrmFollowupsQuery,
  useCreateFollowupMutation,
  useUpdateFollowupMutation,
  useDeleteFollowupMutation,
  useCrmLeadsQuery,
  useUsersQuery,
} from '../../hooks/queries';
import { LeadDetailDrawer } from '../../components/crm/LeadDetailDrawer';
import { useToast } from '../../hooks/useToast';
import './Followups.css';

type ViewType = 'today' | 'upcoming' | 'overdue' | 'completed';

export function Followups() {
  const navigate = useNavigate();
  const toast = useToast();

  const [view, setView] = useState<ViewType>('today');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [leadId, setLeadId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Call');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');

  const { data, isLoading } = useCrmFollowupsQuery({ view });
  const { data: leadsData } = useCrmLeadsQuery({ limit: 100 });
  const { data: users = [] } = useUsersQuery();

  const createMutation = useCreateFollowupMutation();
  const updateMutation = useUpdateFollowupMutation();
  const deleteMutation = useDeleteFollowupMutation();

  const followups = data?.followups || [];
  const leads = leadsData?.leads || [];

  const handleToggleComplete = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    updateMutation.mutate(
      { id, body: { status: nextStatus } },
      {
        onSuccess: () => toast.success(`Follow-up ${nextStatus.toLowerCase()}`),
      },
    );
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this follow-up?')) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Follow-up deleted'),
      });
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !title.trim() || !dueAt) {
      toast.error('Lead, title, and due date are required');
      return;
    }

    createMutation.mutate(
      {
        leadId,
        title: title.trim(),
        type,
        dueAt: new Date(dueAt).toISOString(),
        notes: notes.trim() || undefined,
        assignedUserId: assignedUserId || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Follow-up scheduled');
          setShowCreateModal(false);
          setLeadId('');
          setTitle('');
          setDueAt('');
          setNotes('');
        },
      },
    );
  };

  const handleOpenChat = (phone: string) => {
    navigate(`/chats?contact=${encodeURIComponent(phone)}`);
  };

  return (
    <div className="crm-followups-page">
      {/* Header */}
      <div className="followups-header">
        <div className="followups-title-group">
          <Clock size={24} color="var(--gxa-blue, #0B4DBB)" />
          <h1 className="followups-title">Follow-ups & Reminders</h1>
        </div>
        <button
          className="btn-create-lead"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} /> Schedule Follow-up
        </button>
      </div>

      {/* Tabs */}
      <div className="followups-tabs">
        <button
          className={`tab-btn ${view === 'today' ? 'active' : ''}`}
          onClick={() => setView('today')}
        >
          <Calendar size={16} /> Today
        </button>
        <button
          className={`tab-btn ${view === 'upcoming' ? 'active' : ''}`}
          onClick={() => setView('upcoming')}
        >
          <Clock size={16} /> Upcoming
        </button>
        <button
          className={`tab-btn ${view === 'overdue' ? 'active' : ''}`}
          onClick={() => setView('overdue')}
        >
          <AlertTriangle size={16} /> Overdue
        </button>
        <button
          className={`tab-btn ${view === 'completed' ? 'active' : ''}`}
          onClick={() => setView('completed')}
        >
          <CheckCircle size={16} /> Completed
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="empty-fu-container">
          <Loader2 className="animate-spin" size={32} color="var(--gxa-blue)" />
          <p style={{ color: 'var(--text-secondary)' }}>Loading follow-ups...</p>
        </div>
      ) : followups.length === 0 ? (
        <div className="empty-fu-container">
          <Clock size={40} color="var(--gxa-blue)" />
          <h3 style={{ margin: 0, fontWeight: 700 }}>No follow-ups for {view}</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {view === 'today'
              ? 'You have no pending tasks scheduled for today.'
              : view === 'overdue'
              ? 'Great job! You have zero overdue tasks.'
              : 'Schedule reminders and tasks to keep deals moving forward.'}
          </p>
          <button
            className="btn-create-lead"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} /> Schedule New Follow-up
          </button>
        </div>
      ) : (
        <div className="followups-list">
          {followups.map(fu => {
            const assignee = users.find(u => u.id === fu.assignedUserId);
            return (
              <div key={fu.id} className="followup-card">
                <div className="card-left">
                  <div className="fu-title-row">
                    <span className="type-pill">{fu.type}</span>
                    <h3 className="fu-title">{fu.title}</h3>
                  </div>

                  {fu.lead && (
                    <div className="fu-lead-row">
                      <span>
                        Lead:{' '}
                        <span
                          className="lead-link"
                          onClick={() => setSelectedLeadId(fu.lead!.id)}
                        >
                          {fu.lead.name}
                        </span>
                        {fu.lead.company && ` (${fu.lead.company})`}
                      </span>
                      <span>Phone: {fu.lead.phone}</span>
                      {assignee && <span>Assigned to: {assignee.fullName}</span>}
                    </div>
                  )}

                  {fu.notes && <div className="fu-notes">{fu.notes}</div>}
                </div>

                <div className="card-right">
                  <span
                    className={`due-badge due-${
                      fu.status === 'Completed'
                        ? 'completed'
                        : view === 'overdue'
                        ? 'overdue'
                        : view === 'today'
                        ? 'today'
                        : 'upcoming'
                    }`}
                  >
                    <Clock size={12} /> {new Date(fu.dueAt).toLocaleString()}
                  </span>

                  <div className="fu-actions">
                    {fu.lead && (
                      <button
                        className="action-icon-btn"
                        title="Chat on WhatsApp"
                        onClick={() => handleOpenChat(fu.lead!.phone)}
                      >
                        <MessageSquare size={14} color="#25D366" />
                      </button>
                    )}
                    {fu.lead && (
                      <button
                        className="action-icon-btn"
                        title="View Lead"
                        onClick={() => setSelectedLeadId(fu.lead!.id)}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    <button
                      className="btn-create-lead"
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.75rem',
                        background:
                          fu.status === 'Completed'
                            ? 'var(--text-secondary, #64748b)'
                            : 'var(--gxa-blue, #0B4DBB)',
                      }}
                      onClick={() => handleToggleComplete(fu.id, fu.status)}
                    >
                      <CheckCircle size={13} />{' '}
                      {fu.status === 'Completed' ? 'Reopen' : 'Complete'}
                    </button>
                    <button
                      className="action-icon-btn"
                      title="Delete Follow-up"
                      onClick={() => handleDelete(fu.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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

      {/* Schedule Follow-up Modal */}
      {showCreateModal && (
        <div className="crm-leads-page">
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Schedule New Follow-up</h2>
                <button className="action-icon-btn" onClick={() => setShowCreateModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Select CRM Lead *</label>
                  <select
                    className="filter-select"
                    value={leadId}
                    onChange={e => setLeadId(e.target.value)}
                    required
                  >
                    <option value="">Choose a lead...</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Task Title / Action *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Call client about proposal agreement"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select
                      className="filter-select"
                      value={type}
                      onChange={e => setType(e.target.value)}
                    >
                      <option value="Call">Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Payment">Payment</option>
                      <option value="Proposal">Proposal</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={dueAt}
                      onChange={e => setDueAt(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Agent</label>
                  <select
                    className="filter-select"
                    value={assignedUserId}
                    onChange={e => setAssignedUserId(e.target.value)}
                  >
                    <option value="">Assign to lead owner</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Optional notes or discussion points..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="action-icon-btn"
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-create-lead"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Scheduling...' : 'Save Follow-up'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
