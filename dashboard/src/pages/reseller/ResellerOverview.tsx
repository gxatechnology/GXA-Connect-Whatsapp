import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Users, MessageSquare, Plus, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface ResellerOverviewStats {
  totalClients: number;
  activeClients: number;
  totalUsers: number;
  monthlyMessagesSent: number;
}

export const ResellerOverview: React.FC = () => {
  const { token } = useAuth();
  const { currentOrganization } = useWorkspace();
  const [stats, setStats] = useState<ResellerOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/reseller/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error('Failed to load reseller overview');
        }
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-edge rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/50 uppercase tracking-wider">
              Reseller Partner Console
            </span>
            <span className="text-xs text-content-muted">{currentOrganization?.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-content tracking-tight">Partner Dashboard</h1>
          <p className="text-sm text-content-muted mt-1">
            Manage your white-labeled client accounts, monitor customer message volume, and provision new workspaces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to="/reseller/clients"
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
          >
            <Plus size={15} /> Provision Client Account
          </NavLink>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Total Clients</span>
            <div className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.totalClients ?? 0}
          </div>
          <div className="text-xs text-content-muted pt-2 border-t border-edge/60">
            <span>Workspaces in your portfolio</span>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Active Clients</span>
            <div className="p-2 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-800/40">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.activeClients ?? 0}
          </div>
          <div className="text-xs text-content-muted pt-2 border-t border-edge/60">
            <span>Active & transmitting</span>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Customer Users</span>
            <div className="p-2 rounded-lg bg-indigo-950/40 text-indigo-400 border border-indigo-800/40">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.totalUsers ?? 0}
          </div>
          <div className="text-xs text-content-muted pt-2 border-t border-edge/60">
            <span>Users across child workspaces</span>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Monthly Messages</span>
            <div className="p-2 rounded-lg bg-purple-950/40 text-purple-400 border border-purple-800/40">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.monthlyMessagesSent?.toLocaleString() ?? 0}
          </div>
          <div className="text-xs text-content-muted pt-2 border-t border-edge/60">
            <span>Current month total</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <NavLink
          to="/reseller/clients"
          className="bg-surface hover:bg-surface-elevated/50 border border-edge rounded-xl p-5 shadow-sm transition block space-y-2 group"
        >
          <div className="font-semibold text-content group-hover:text-brand transition flex items-center justify-between">
            <span>Manage Client Accounts</span>
            <span>&rarr;</span>
          </div>
          <p className="text-xs text-content-muted leading-relaxed">
            Provision new client businesses, update account statuses, and switch into client workspaces for support.
          </p>
        </NavLink>

        <NavLink
          to="/reseller/usage"
          className="bg-surface hover:bg-surface-elevated/50 border border-edge rounded-xl p-5 shadow-sm transition block space-y-2 group"
        >
          <div className="font-semibold text-content group-hover:text-brand transition flex items-center justify-between">
            <span>Client Usage & Consumption</span>
            <span>&rarr;</span>
          </div>
          <p className="text-xs text-content-muted leading-relaxed">
            Monitor real-time monthly message throughput and campaign recipient volume across each of your client accounts.
          </p>
        </NavLink>
      </div>
    </div>
  );
};
