import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Layers, Plus, Edit2, Check, X, AlertCircle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description?: string | null;
  status: 'active' | 'archived';
  isSystemPlan: boolean;
  maxUsers?: number | null;
  maxWhatsAppAccounts?: number | null;
  maxContacts?: number | null;
  maxMonthlyMessages?: number | null;
  maxCampaignRecipients?: number | null;
  maxClientOrganizations?: number | null;
  apiAccess: boolean;
  crmEnabled: boolean;
  automationEnabled: boolean;
  reportsEnabled: boolean;
  createdAt: string;
}

export const Plans: React.FC = () => {
  const { token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxUsers: '',
    maxWhatsAppAccounts: '',
    maxContacts: '',
    maxMonthlyMessages: '',
    maxCampaignRecipients: '',
    maxClientOrganizations: '',
    apiAccess: true,
    crmEnabled: true,
    automationEnabled: true,
    reportsEnabled: true,
  });

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/plans', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [token]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      description: '',
      maxUsers: '10',
      maxWhatsAppAccounts: '2',
      maxContacts: '1000',
      maxMonthlyMessages: '5000',
      maxCampaignRecipients: '500',
      maxClientOrganizations: '',
      apiAccess: true,
      crmEnabled: true,
      automationEnabled: true,
      reportsEnabled: true,
    });
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      maxUsers: plan.maxUsers !== null && plan.maxUsers !== undefined ? String(plan.maxUsers) : '',
      maxWhatsAppAccounts: plan.maxWhatsAppAccounts !== null && plan.maxWhatsAppAccounts !== undefined ? String(plan.maxWhatsAppAccounts) : '',
      maxContacts: plan.maxContacts !== null && plan.maxContacts !== undefined ? String(plan.maxContacts) : '',
      maxMonthlyMessages: plan.maxMonthlyMessages !== null && plan.maxMonthlyMessages !== undefined ? String(plan.maxMonthlyMessages) : '',
      maxCampaignRecipients: plan.maxCampaignRecipients !== null && plan.maxCampaignRecipients !== undefined ? String(plan.maxCampaignRecipients) : '',
      maxClientOrganizations: plan.maxClientOrganizations !== null && plan.maxClientOrganizations !== undefined ? String(plan.maxClientOrganizations) : '',
      apiAccess: plan.apiAccess,
      crmEnabled: plan.crmEnabled,
      automationEnabled: plan.automationEnabled,
      reportsEnabled: plan.reportsEnabled,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        maxUsers: formData.maxUsers ? parseInt(formData.maxUsers, 10) : null,
        maxWhatsAppAccounts: formData.maxWhatsAppAccounts ? parseInt(formData.maxWhatsAppAccounts, 10) : null,
        maxContacts: formData.maxContacts ? parseInt(formData.maxContacts, 10) : null,
        maxMonthlyMessages: formData.maxMonthlyMessages ? parseInt(formData.maxMonthlyMessages, 10) : null,
        maxCampaignRecipients: formData.maxCampaignRecipients ? parseInt(formData.maxCampaignRecipients, 10) : null,
        maxClientOrganizations: formData.maxClientOrganizations ? parseInt(formData.maxClientOrganizations, 10) : null,
        apiAccess: formData.apiAccess,
        crmEnabled: formData.crmEnabled,
        automationEnabled: formData.automationEnabled,
        reportsEnabled: formData.reportsEnabled,
      };

      const url = editingPlan ? `/api/plans/${editingPlan.id}` : '/api/plans';
      const method = editingPlan ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save subscription plan');
      }

      setShowModal(false);
      await fetchPlans();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/50 uppercase tracking-wider">
              Platform Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2.5">
            <Layers className="text-indigo-400" size={24} /> Plans & Feature Quotas
          </h1>
          <p className="text-xs text-content-muted mt-1">
            Define subscription tiers, maximum resource limits, and gate CRM / developer features per organization.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} /> Create New Plan
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map(p => (
          <div
            key={p.id}
            className={`bg-surface border ${
              p.status === 'archived' ? 'border-edge opacity-60' : 'border-edge'
            } rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-edge-strong transition`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-content">{p.name}</h3>
                  <p className="text-xs text-content-muted mt-0.5">{p.description || 'Custom tier'}</p>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                    p.status === 'active'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {p.status}
                </span>
              </div>

              {/* Resource Quotas */}
              <div className="space-y-2 pt-2 border-t border-edge/60 text-xs">
                <div className="flex justify-between py-1 border-b border-edge/40">
                  <span className="text-content-muted">Team Users:</span>
                  <span className="font-semibold text-content">{p.maxUsers ? p.maxUsers : 'Unlimited'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-edge/40">
                  <span className="text-content-muted">WhatsApp Accounts:</span>
                  <span className="font-semibold text-content">{p.maxWhatsAppAccounts ? p.maxWhatsAppAccounts : 'Unlimited'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-edge/40">
                  <span className="text-content-muted">Max Contacts:</span>
                  <span className="font-semibold text-content">{p.maxContacts ? p.maxContacts.toLocaleString() : 'Unlimited'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-edge/40">
                  <span className="text-content-muted">Monthly Messages:</span>
                  <span className="font-semibold text-content">{p.maxMonthlyMessages ? p.maxMonthlyMessages.toLocaleString() : 'Unlimited'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-edge/40">
                  <span className="text-content-muted">Campaign Recipients:</span>
                  <span className="font-semibold text-content">{p.maxCampaignRecipients ? p.maxCampaignRecipients.toLocaleString() : 'Unlimited'}</span>
                </div>
                {p.maxClientOrganizations !== null && p.maxClientOrganizations !== undefined && (
                  <div className="flex justify-between py-1 border-b border-edge/40">
                    <span className="text-content-muted">Child Clients (Reseller):</span>
                    <span className="font-semibold text-amber-400">{p.maxClientOrganizations}</span>
                  </div>
                )}
              </div>

              {/* Feature Flags */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
                  Feature Permissions
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {p.crmEnabled ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-red-400" />}
                    <span className={p.crmEnabled ? 'text-content' : 'text-content-muted'}>CRM Suite</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.automationEnabled ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-red-400" />}
                    <span className={p.automationEnabled ? 'text-content' : 'text-content-muted'}>Automations</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.apiAccess ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-red-400" />}
                    <span className={p.apiAccess ? 'text-content' : 'text-content-muted'}>Developer API</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.reportsEnabled ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-red-400" />}
                    <span className={p.reportsEnabled ? 'text-content' : 'text-content-muted'}>Reports</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-edge flex items-center justify-end gap-2">
              <button
                onClick={() => openEditModal(p)}
                className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated/80 border border-edge text-content text-xs font-medium rounded-lg transition inline-flex items-center gap-1"
              >
                <Edit2 size={13} /> Edit Plan
              </button>
            </div>
          </div>
        ))}

        {plans.length === 0 && !isLoading && (
          <div className="col-span-full py-12 text-center text-xs text-content-muted bg-surface border border-edge rounded-2xl">
            No custom subscription plans created yet. Click &quot;Create New Plan&quot; to define your first tier.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-edge rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-edge flex items-center justify-between bg-surface-muted/40">
              <h2 className="text-base font-bold text-content flex items-center gap-2">
                <Layers className="text-indigo-400" size={18} /> {editingPlan ? 'Edit Plan' : 'Create New Subscription Plan'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-content-muted hover:text-content transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-content">Plan Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Enterprise Business"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-content">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. For high-volume marketing teams"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Max Team Users</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxUsers}
                    onChange={e => setFormData({ ...formData, maxUsers: e.target.value })}
                    placeholder="Blank for unlimited"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Max WhatsApp Accounts</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxWhatsAppAccounts}
                    onChange={e => setFormData({ ...formData, maxWhatsAppAccounts: e.target.value })}
                    placeholder="Blank for unlimited"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Max Contacts</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxContacts}
                    onChange={e => setFormData({ ...formData, maxContacts: e.target.value })}
                    placeholder="Blank for unlimited"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Max Monthly Messages</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxMonthlyMessages}
                    onChange={e => setFormData({ ...formData, maxMonthlyMessages: e.target.value })}
                    placeholder="Blank for unlimited"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Max Campaign Recipients</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxCampaignRecipients}
                    onChange={e => setFormData({ ...formData, maxCampaignRecipients: e.target.value })}
                    placeholder="Blank for unlimited"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Max Child Clients (Reseller)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxClientOrganizations}
                    onChange={e => setFormData({ ...formData, maxClientOrganizations: e.target.value })}
                    placeholder="Blank if client-only plan"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-edge/60 space-y-2">
                <div className="text-xs font-semibold text-content mb-2">Feature Permissions</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.crmEnabled}
                      onChange={e => setFormData({ ...formData, crmEnabled: e.target.checked })}
                      className="rounded border-edge text-brand focus:ring-0"
                    />
                    <span>CRM Lead Management</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.automationEnabled}
                      onChange={e => setFormData({ ...formData, automationEnabled: e.target.checked })}
                      className="rounded border-edge text-brand focus:ring-0"
                    />
                    <span>Campaigns & Automations</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.apiAccess}
                      onChange={e => setFormData({ ...formData, apiAccess: e.target.checked })}
                      className="rounded border-edge text-brand focus:ring-0"
                    />
                    <span>Developer API & Webhooks</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reportsEnabled}
                      onChange={e => setFormData({ ...formData, reportsEnabled: e.target.checked })}
                      className="rounded border-edge text-brand focus:ring-0"
                    />
                    <span>Analytics & Reports</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-edge">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-content-muted hover:text-content transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
