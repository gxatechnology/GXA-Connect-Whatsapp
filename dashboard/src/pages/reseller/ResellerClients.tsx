import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Users, Plus, Search, AlertCircle, X, ExternalLink, Shield } from 'lucide-react';

interface ClientOrg {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  planId?: string | null;
  planName?: string;
  membersCount: number;
  createdAt: string;
}

export const ResellerClients: React.FC = () => {
  const { token } = useAuth();
  const { switchWorkspace } = useWorkspace();
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/reseller/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch('/api/reseller/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to provision client account');
      }

      setShowModal(false);
      setFormData({
        name: '',
        slug: '',
        adminFullName: '',
        adminEmail: '',
        adminPassword: '',
      });
      await fetchClients();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (client: ClientOrg) => {
    const nextStatus = client.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/reseller/clients/${client.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update client status');
      }

      await fetchClients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/50 uppercase tracking-wider">
              Reseller Partner
            </span>
          </div>
          <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2.5">
            <Users className="text-emerald-400" size={24} /> Client Accounts
          </h1>
          <p className="text-xs text-content-muted mt-1">
            Manage all client businesses created under your reseller partnership.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} /> Provision New Client
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
          placeholder="Filter by client name or slug..."
          className="w-full bg-transparent text-xs text-content placeholder:text-content-muted focus:outline-none"
        />
        <span className="text-xs text-content-muted pr-2 flex-shrink-0">
          {filtered.length} {filtered.length === 1 ? 'client' : 'clients'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-surface border border-edge rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted/60 text-content-muted uppercase tracking-wider text-[10px] border-b border-edge">
              <tr>
                <th className="py-3 px-4 font-semibold">Client Name</th>
                <th className="py-3 px-4 font-semibold">Slug / ID</th>
                <th className="py-3 px-4 font-semibold">Members</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Created</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50 text-content">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-surface-elevated/40 transition">
                  <td className="py-3.5 px-4 font-medium flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[10px] text-content-muted">Client Workspace</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-content-muted text-[11px]">
                    /{c.slug}
                  </td>
                  <td className="py-3.5 px-4 text-content-muted">
                    {c.membersCount} {c.membersCount === 1 ? 'user' : 'users'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        c.status === 'active'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                          : 'bg-red-950/60 text-red-300 border-red-800/50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-content-muted text-[11px]">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => switchWorkspace(c.id)}
                      className="px-2.5 py-1 rounded bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 text-[11px] font-medium transition inline-flex items-center gap-1"
                      title="Switch active console context into this client"
                    >
                      <ExternalLink size={12} /> Enter Workspace
                    </button>
                    <button
                      onClick={() => handleToggleStatus(c)}
                      className={`px-2.5 py-1 rounded border text-[11px] font-medium transition ${
                        c.status === 'active'
                          ? 'bg-red-950/30 hover:bg-red-950/50 text-red-300 border-red-800/40'
                          : 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 border-emerald-800/40'
                      }`}
                    >
                      {c.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-content-muted">
                    No client accounts provisioned yet. Click &quot;Provision New Client&quot; to add your first customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-edge rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-edge flex items-center justify-between bg-surface-muted/40">
              <h2 className="text-base font-bold text-content flex items-center gap-2">
                <Users className="text-emerald-400" size={18} /> Provision Client Account
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
                <label className="text-xs font-semibold text-content">Client Business Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Acme Logistics"
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
                  placeholder="e.g. acme-logistics"
                  className="w-full px-3 py-2 text-xs font-mono bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                />
              </div>

              <div className="border-t border-edge/60 pt-4 space-y-3">
                <div className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Shield size={14} className="text-brand" /> Client Administrator Account
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-content-muted">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.adminFullName}
                    onChange={e => setFormData({ ...formData, adminFullName: e.target.value })}
                    placeholder="e.g. Alice Johnson"
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
                    placeholder="alice@acme.com"
                    className="w-full px-3 py-2 text-xs bg-surface-base border border-edge rounded-lg text-content focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-content-muted">Initial Password</label>
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
                  {isSubmitting ? 'Provisioning...' : 'Provision Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
