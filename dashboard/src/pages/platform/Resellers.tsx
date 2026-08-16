import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Building, Plus, Search, AlertCircle, X, ExternalLink, Shield } from 'lucide-react';

interface ResellerOrg {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  planId?: string | null;
  planName?: string;
  membersCount: number;
  createdAt: string;
}

interface Plan {
  id: string;
  name: string;
}

export const Resellers: React.FC = () => {
  const { token } = useAuth();
  const { switchWorkspace } = useWorkspace();
  const [resellers, setResellers] = useState<ResellerOrg[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    planId: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const fetchResellers = async () => {
    try {
      setIsLoading(true);
      const [resellersRes, plansRes] = await Promise.all([
        fetch('/api/platform/resellers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/plans', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resellersRes.ok) {
        const data = await resellersRes.json();
        setResellers(data);
      }
      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResellers();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch('/api/platform/resellers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create reseller organization');
      }

      setShowModal(false);
      setFormData({
        name: '',
        slug: '',
        planId: '',
        adminFullName: '',
        adminEmail: '',
        adminPassword: '',
      });
      await fetchResellers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (reseller: ResellerOrg) => {
    const nextStatus = reseller.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/platform/organizations/${reseller.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update reseller status');
      }

      await fetchResellers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = resellers.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <Building className="text-amber-400" size={24} /> Reseller Partners
          </h1>
          <p className="text-xs text-content-muted mt-1">
            Manage white-label reseller organizations, provision partner accounts, and monitor quota allocations.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} /> New Reseller Partner
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-surface border border-edge rounded-xl p-3 flex items-center gap-3">
        <Search size={16} className="text-content-muted ml-1 flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter by reseller name or workspace slug..."
          className="w-full bg-transparent text-xs text-content placeholder:text-content-muted focus:outline-none"
        />
        <span className="text-xs text-content-muted pr-2 flex-shrink-0">
          {filtered.length} {filtered.length === 1 ? 'partner' : 'partners'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-surface border border-edge rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted/60 text-content-muted uppercase tracking-wider text-[10px] border-b border-edge">
              <tr>
                <th className="py-3 px-4 font-semibold">Reseller Name</th>
                <th className="py-3 px-4 font-semibold">Slug / ID</th>
                <th className="py-3 px-4 font-semibold">Assigned Plan</th>
                <th className="py-3 px-4 font-semibold">Members</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Created</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50 text-content">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-surface-elevated/40 transition">
                  <td className="py-3.5 px-4 font-medium flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-[10px] text-content-muted">Reseller Partition</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-content-muted text-[11px]">
                    /{r.slug}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-surface-base border border-edge text-[11px] font-medium">
                      {r.planName || 'Reseller Standard'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-content-muted">
                    {r.membersCount} {r.membersCount === 1 ? 'user' : 'users'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        r.status === 'active'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                          : 'bg-red-950/60 text-red-300 border-red-800/50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-content-muted text-[11px]">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => switchWorkspace(r.id)}
                      className="px-2.5 py-1 rounded bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 text-[11px] font-medium transition inline-flex items-center gap-1"
                      title="Switch active console context into this reseller"
                    >
                      <ExternalLink size={12} /> Enter Workspace
                    </button>
                    <button
                      onClick={() => handleToggleStatus(r)}
                      className={`px-2.5 py-1 rounded border text-[11px] font-medium transition ${
                        r.status === 'active'
                          ? 'bg-red-950/30 hover:bg-red-950/50 text-red-300 border-red-800/40'
                          : 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 border-emerald-800/40'
                      }`}
                    >
                      {r.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-content-muted">
                    No reseller partners registered yet. Click &quot;New Reseller Partner&quot; to provision one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-edge rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-edge flex items-center justify-between bg-surface-muted/40">
              <h2 className="text-base font-bold text-content flex items-center gap-2">
                <Building className="text-amber-400" size={18} /> Provision Reseller Organization
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-content-muted hover:text-content transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Organization Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Apex Messaging Partners"
                  className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Workspace Slug</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="e.g. apex-messaging"
                  className="w-full px-3 py-2 text-xs font-mono bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                />
                <p className="text-[10px] text-content-muted">Alphanumeric characters and hyphens only.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Subscription Tier Plan</label>
                <select
                  value={formData.planId}
                  onChange={e => setFormData({ ...formData, planId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                >
                  <option value="">Default Reseller Plan</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-edge/60 pt-4 space-y-3">
                <div className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Shield size={14} className="text-brand" /> Reseller Administrator Credentials
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-content-muted">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.adminFullName}
                    onChange={e => setFormData({ ...formData, adminFullName: e.target.value })}
                    placeholder="e.g. Sarah Connor"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-content-muted">Admin Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="admin@partner.com"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-content-muted">Temporary Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.adminPassword}
                    onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
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
                  {isSubmitting ? 'Provisioning...' : 'Create Reseller Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
