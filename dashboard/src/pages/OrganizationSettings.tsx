import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Settings, Shield, Users, Smartphone, MessageSquare, Megaphone, Check, X, AlertCircle, Plus } from 'lucide-react';

interface MemberItem {
  id: string;
  userId: string;
  role: string;
  status: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    status: string;
    lastLoginAt?: string | null;
  };
}

export const OrganizationSettings: React.FC = () => {
  const { token } = useAuth();
  const { currentOrganization, limits, usage, currentRole, platformRole, refreshWorkspace } = useWorkspace();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add Member Form
  const [memberForm, setMemberForm] = useState({
    email: '',
    fullName: '',
    role: 'agent',
    password: '',
  });

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/organizations/members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [token, currentOrganization?.id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch('/api/organizations/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(memberForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to add team member');
      }

      setShowAddMember(false);
      setMemberForm({ email: '', fullName: '', role: 'agent', password: '' });
      await fetchMembers();
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatePct = (current: number, max: number | null | undefined) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((current / max) * 100));
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return 'bg-rose-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-brand';
  };

  const canManage = currentRole === 'admin' || platformRole === 'super_admin';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 uppercase tracking-wider">
            Workspace Configuration
          </span>
        </div>
        <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2.5">
          <Settings className="text-brand" size={24} /> Workspace & Subscription Plan
        </h1>
        <p className="text-xs text-content-muted mt-1">
          Review your organization plan quotas, real-time message consumption, feature permissions, and team access.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Org Details + Plan Quotas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace Info Card */}
        <div className="bg-surface border border-edge rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-lg">
              {currentOrganization?.name?.charAt(0).toUpperCase() || 'W'}
            </div>
            <div>
              <h2 className="text-base font-bold text-content">{currentOrganization?.name}</h2>
              <p className="text-xs font-mono text-content-muted">/{currentOrganization?.slug}</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-edge/60 text-xs">
            <div className="flex justify-between py-1 border-b border-edge/40">
              <span className="text-content-muted">Workspace Type:</span>
              <span className="font-semibold text-content uppercase">{currentOrganization?.type}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-edge/40">
              <span className="text-content-muted">Your Role:</span>
              <span className="font-semibold text-brand uppercase">{currentRole}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-edge/40">
              <span className="text-content-muted">Current Plan:</span>
              <span className="font-semibold text-content">{limits?.planName || 'Standard'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-edge/40">
              <span className="text-content-muted">Account Status:</span>
              <span className="font-semibold text-emerald-400 uppercase">{currentOrganization?.status}</span>
            </div>
          </div>

          {/* Feature Permissions */}
          <div className="pt-2">
            <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2.5">
              Available Modules
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-content">CRM Lead Engine</span>
                {limits?.crmEnabled ? <Check size={15} className="text-emerald-400" /> : <X size={15} className="text-red-400" />}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content">Campaigns & Automations</span>
                {limits?.automationEnabled ? <Check size={15} className="text-emerald-400" /> : <X size={15} className="text-red-400" />}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content">Developer API & Webhooks</span>
                {limits?.apiAccess ? <Check size={15} className="text-emerald-400" /> : <X size={15} className="text-red-400" />}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content">Analytics Reports</span>
                {limits?.reportsEnabled ? <Check size={15} className="text-emerald-400" /> : <X size={15} className="text-red-400" />}
              </div>
            </div>
          </div>
        </div>

        {/* Quotas & Live Consumption */}
        <div className="bg-surface border border-edge rounded-2xl p-6 shadow-sm space-y-5 lg:col-span-2">
          <div>
            <h2 className="text-base font-bold text-content">Monthly Quota Consumption</h2>
            <p className="text-xs text-content-muted mt-0.5">
              Resource utilization for the current calendar month.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            {/* Monthly Messages */}
            <div className="p-4 rounded-xl bg-surface-base border border-edge space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <MessageSquare size={15} className="text-purple-400" /> Monthly Messages
                </span>
                <span className="text-xs text-content-muted">
                  {usage?.messagesSent ?? 0} / {limits?.maxMonthlyMessages ? limits.maxMonthlyMessages.toLocaleString() : 'Unlimited'}
                </span>
              </div>
              {limits?.maxMonthlyMessages ? (
                <div className="w-full h-2 bg-surface border border-edge rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(calculatePct(usage?.messagesSent ?? 0, limits.maxMonthlyMessages))} transition-all`}
                    style={{ width: `${calculatePct(usage?.messagesSent ?? 0, limits.maxMonthlyMessages)}%` }}
                  />
                </div>
              ) : (
                <div className="w-full h-2 bg-brand/30 rounded-full" />
              )}
              <div className="text-[10px] text-content-muted">Resets at the start of next calendar month.</div>
            </div>

            {/* Campaign Recipients */}
            <div className="p-4 rounded-xl bg-surface-base border border-edge space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Megaphone size={15} className="text-rose-400" /> Campaign Recipients
                </span>
                <span className="text-xs text-content-muted">
                  {usage?.campaignRecipientsProcessed ?? 0} / {limits?.maxCampaignRecipients ? limits.maxCampaignRecipients.toLocaleString() : 'Unlimited'}
                </span>
              </div>
              {limits?.maxCampaignRecipients ? (
                <div className="w-full h-2 bg-surface border border-edge rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(calculatePct(usage?.campaignRecipientsProcessed ?? 0, limits.maxCampaignRecipients))} transition-all`}
                    style={{ width: `${calculatePct(usage?.campaignRecipientsProcessed ?? 0, limits.maxCampaignRecipients)}%` }}
                  />
                </div>
              ) : (
                <div className="w-full h-2 bg-rose-500/30 rounded-full" />
              )}
              <div className="text-[10px] text-content-muted">Cumulative broadcast throughput.</div>
            </div>

            {/* Team User Limit */}
            <div className="p-4 rounded-xl bg-surface-base border border-edge space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Users size={15} className="text-indigo-400" /> Team Users Allowed
                </span>
                <span className="text-xs text-content-muted">
                  {members.length} / {limits?.maxUsers ? limits.maxUsers : 'Unlimited'}
                </span>
              </div>
              {limits?.maxUsers ? (
                <div className="w-full h-2 bg-surface border border-edge rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(calculatePct(members.length, limits.maxUsers))} transition-all`}
                    style={{ width: `${calculatePct(members.length, limits.maxUsers)}%` }}
                  />
                </div>
              ) : (
                <div className="w-full h-2 bg-indigo-500/30 rounded-full" />
              )}
              <div className="text-[10px] text-content-muted">Active staff member accounts.</div>
            </div>

            {/* WhatsApp Accounts Limit */}
            <div className="p-4 rounded-xl bg-surface-base border border-edge space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Smartphone size={15} className="text-emerald-400" /> WhatsApp Numbers
                </span>
                <span className="text-xs text-content-muted">
                  Allowed: {limits?.maxWhatsAppAccounts ? limits.maxWhatsAppAccounts : 'Unlimited'}
                </span>
              </div>
              <div className="w-full h-2 bg-emerald-500/30 rounded-full" />
              <div className="text-[10px] text-content-muted">Simultaneous linked phone sessions.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-surface border border-edge rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-edge flex items-center justify-between bg-surface-muted/40">
          <div>
            <h2 className="text-base font-bold text-content flex items-center gap-2">
              <Shield size={18} className="text-brand" /> Workspace Team Members
            </h2>
            <p className="text-xs text-content-muted mt-0.5">
              Users granted access to this workspace.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setShowAddMember(true)}
              className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Plus size={15} /> Add Team Member
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted/60 text-content-muted uppercase tracking-wider text-[10px] border-b border-edge">
              <tr>
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Email</th>
                <th className="py-3 px-4 font-semibold">Workspace Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50 text-content">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-surface-elevated/40 transition">
                  <td className="py-3.5 px-4 font-medium flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-base border border-edge flex items-center justify-center text-content font-bold text-xs">
                      {m.user?.fullName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span>{m.user?.fullName || 'Team User'}</span>
                  </td>
                  <td className="py-3.5 px-4 text-content-muted font-mono">{m.user?.email}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-surface-base border border-edge text-[11px] font-semibold uppercase text-brand">
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        m.status === 'active'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {m.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-content-muted text-[11px]">
                    {m.user?.lastLoginAt ? new Date(m.user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}

              {members.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-content-muted">
                    No team members registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-edge rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-edge flex items-center justify-between bg-surface-muted/40">
              <h2 className="text-base font-bold text-content flex items-center gap-2">
                <Users size={18} className="text-brand" /> Add Team Member
              </h2>
              <button
                onClick={() => setShowAddMember(false)}
                className="text-content-muted hover:text-content transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Email Address</label>
                <input
                  type="email"
                  required
                  value={memberForm.email}
                  onChange={e => setMemberForm({ ...memberForm, email: e.target.value })}
                  placeholder="agent@company.com"
                  className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Full Name (if new user)</label>
                <input
                  type="text"
                  value={memberForm.fullName}
                  onChange={e => setMemberForm({ ...memberForm, fullName: e.target.value })}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Workspace Role</label>
                <select
                  value={memberForm.role}
                  onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                >
                  <option value="agent">Agent (Inbox & CRM Access)</option>
                  <option value="manager">Manager (CRM & Team Oversight)</option>
                  <option value="admin">Admin (Full Workspace Management)</option>
                  <option value="viewer">Viewer (Read Only)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Password (if new user)</label>
                <input
                  type="password"
                  minLength={6}
                  value={memberForm.password}
                  onChange={e => setMemberForm({ ...memberForm, password: e.target.value })}
                  placeholder="Min 6 chars (ignored if user already exists)"
                  className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-edge">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="px-4 py-2 text-xs font-medium text-content-muted hover:text-content transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
