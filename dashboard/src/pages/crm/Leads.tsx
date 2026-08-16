import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  Search,
  Plus,
  MessageSquare,
  Eye,
  Archive,
  X,
  Loader2,
} from 'lucide-react';
import {
  useCrmLeadsQuery,
  useCreateLeadMutation,
  useDeleteLeadMutation,
  useCrmTagsQuery,
  useUsersQuery,
} from '../../hooks/queries';
import { LeadDetailDrawer } from '../../components/crm/LeadDetailDrawer';
import { useToast } from '../../hooks/useToast';
import './Leads.css';

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const SOURCES = ['WhatsApp', 'Campaign', 'Manual', 'Imported', 'Website', 'Referral', 'Other'];

export function Leads() {
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [source, setSource] = useState('Manual');
  const [stage, setStage] = useState('New');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [initialTag, setInitialTag] = useState('');
  const [initialNotes, setInitialNotes] = useState('');

  const queryParams = useMemo(() => ({
    search: search.trim() || undefined,
    stage: selectedStage !== 'all' ? selectedStage : undefined,
    source: selectedSource !== 'all' ? selectedSource : undefined,
    assignedUserId: selectedAgent || undefined,
    tagId: selectedTag || undefined,
  }), [search, selectedStage, selectedSource, selectedAgent, selectedTag]);

  const { data, isLoading } = useCrmLeadsQuery(queryParams);
  const { data: allTags = [] } = useCrmTagsQuery();
  const { data: users = [] } = useUsersQuery();

  const createLeadMutation = useCreateLeadMutation();
  const deleteLeadMutation = useDeleteLeadMutation();

  const leads = data?.leads || [];
  const total = data?.total || 0;

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }

    createLeadMutation.mutate(
      {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        source,
        stage,
        assignedUserId: assignedUserId || undefined,
        tags: initialTag ? [initialTag] : undefined,
        notes: initialNotes.trim() || undefined,
      },
      {
        onSuccess: (newLead) => {
          toast.success('Lead created successfully');
          setShowCreateModal(false);
          setName('');
          setPhone('');
          setEmail('');
          setCompany('');
          setInitialNotes('');
          setInitialTag('');
          setSelectedLeadId(newLead.id);
        },
        onError: (err) => {
          toast.error((err as Error).message || 'Failed to create lead');
        },
      },
    );
  };

  const handleArchiveLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to archive this lead?')) {
      deleteLeadMutation.mutate(id, {
        onSuccess: () => toast.success('Lead archived'),
      });
    }
  };

  const handleOpenWhatsApp = (leadPhone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/chats?contact=${encodeURIComponent(leadPhone)}`);
  };

  return (
    <div className="crm-leads-page">
      {/* Header */}
      <div className="leads-header">
        <div className="leads-title-group">
          <h1 className="leads-title">CRM Leads</h1>
          <span className="leads-count-badge">{total} leads</span>
        </div>
        <div className="leads-actions">
          <button className="btn-create-lead" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Lead
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="leads-filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search leads by name, company, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={selectedStage}
          onChange={e => setSelectedStage(e.target.value)}
        >
          <option value="all">All Stages</option>
          {STAGES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={selectedSource}
          onChange={e => setSelectedSource(e.target.value)}
        >
          <option value="all">All Sources</option>
          {SOURCES.map(src => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
        >
          <option value="">All Assignees</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={selectedTag}
          onChange={e => setSelectedTag(e.target.value)}
        >
          <option value="">All Tags</option>
          {allTags.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Leads Table or Empty State */}
      {isLoading ? (
        <div className="empty-leads-container">
          <Loader2 className="animate-spin" size={32} color="var(--gxa-blue)" />
          <p className="empty-leads-desc">Loading CRM leads...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="empty-leads-container">
          <div className="empty-leads-icon">
            <UserCheck size={28} />
          </div>
          <h3 className="empty-leads-title">No CRM Leads Found</h3>
          <p className="empty-leads-desc">
            {search || selectedStage !== 'all' || selectedSource !== 'all' || selectedAgent || selectedTag
              ? 'No leads matched your filter criteria. Try clearing some filters.'
              : 'Start building your pipeline by adding your first CRM lead or importing contacts from WhatsApp.'}
          </p>
          <button className="btn-create-lead" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create First Lead
          </button>
        </div>
      ) : (
        <div className="leads-table-container">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Lead / Contact</th>
                <th>Phone</th>
                <th>Company</th>
                <th>Stage</th>
                <th>Assigned Agent</th>
                <th>Tags</th>
                <th>Next Follow-up</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                const assignee = users.find(u => u.id === lead.assignedUserId);
                return (
                  <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                    <td>
                      <div className="lead-name-cell">
                        <span>{lead.name}</span>
                        {lead.email && <span className="lead-subtext">{lead.email}</span>}
                      </div>
                    </td>
                    <td>{lead.phone}</td>
                    <td>{lead.company || '—'}</td>
                    <td>
                      <span className={`stage-badge stage-${lead.stage.toLowerCase()}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td>{assignee ? assignee.fullName : <span style={{ color: 'var(--text-secondary)' }}>Unassigned</span>}</td>
                    <td>
                      <div className="table-tags">
                        {lead.tags && lead.tags.length > 0 ? (
                          lead.tags.map(t => (
                            <span
                              key={t.id}
                              className="mini-tag-chip"
                              style={{
                                backgroundColor: `${t.color || '#0B4DBB'}20`,
                                color: t.color || '#0B4DBB',
                              }}
                            >
                              {t.name}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {lead.nextFollowUpAt ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                          {new Date(lead.nextFollowUpAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="action-icon-btn"
                          title="Open WhatsApp Chat"
                          onClick={e => handleOpenWhatsApp(lead.phone, e)}
                        >
                          <MessageSquare size={14} color="#25D366" />
                        </button>
                        <button
                          className="action-icon-btn"
                          title="View Lead Details"
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="action-icon-btn"
                          title="Archive Lead"
                          onClick={e => handleArchiveLead(lead.id, e)}
                        >
                          <Archive size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead Detail Drawer */}
      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New CRM Lead</h2>
              <button className="action-icon-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. +1 555 123 4567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="john@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company / Organization</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Acme Corp"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Stage</label>
                  <select
                    className="filter-select"
                    value={stage}
                    onChange={e => setStage(e.target.value)}
                  >
                    {STAGES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Source</label>
                  <select
                    className="filter-select"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                  >
                    {SOURCES.map(src => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Assign Agent</label>
                  <select
                    className="filter-select"
                    value={assignedUserId}
                    onChange={e => setAssignedUserId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Tag</label>
                  <select
                    className="filter-select"
                    value={initialTag}
                    onChange={e => setInitialTag(e.target.value)}
                  >
                    <option value="">None</option>
                    {allTags.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Initial Internal Note (Optional)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Add any initial context or notes..."
                  value={initialNotes}
                  onChange={e => setInitialNotes(e.target.value)}
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
                  disabled={createLeadMutation.isPending}
                >
                  {createLeadMutation.isPending ? 'Creating...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
