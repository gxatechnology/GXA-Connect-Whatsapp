import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building, Users, MessageSquare, Megaphone, ShieldCheck, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface PlatformOverviewStats {
  activeResellers: number;
  activeClients: number;
  totalOrganizations: number;
  totalUsers: number;
  monthlyMessagesSent: number;
  monthlyCampaignRecipients: number;
}

export const PlatformOverview: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<PlatformOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/platform/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error('Failed to load platform statistics');
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/50 uppercase tracking-wider">
              Super Admin Console
            </span>
            <span className="text-xs text-content-muted">Multi-Tenant Management</span>
          </div>
          <h1 className="text-2xl font-bold text-content tracking-tight">GXA Platform Overview</h1>
          <p className="text-sm text-content-muted mt-1">
            Executive oversight of reseller partitions, client organizations, tenant limits, and platform message throughput.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to="/platform/resellers"
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
          >
            <Plus size={15} /> New Reseller
          </NavLink>
          <NavLink
            to="/platform/clients"
            className="px-4 py-2 bg-surface-elevated hover:bg-surface-elevated/80 border border-edge text-content text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
          >
            <Plus size={15} /> Direct Client
          </NavLink>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Active Resellers</span>
            <div className="p-2 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-800/40">
              <Building size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.activeResellers ?? 0}
          </div>
          <div className="text-xs text-content-muted flex items-center justify-between pt-2 border-t border-edge/60">
            <span>Independent partner partitions</span>
            <NavLink to="/platform/resellers" className="text-brand hover:underline">Manage &rarr;</NavLink>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Active Clients</span>
            <div className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.activeClients ?? 0}
          </div>
          <div className="text-xs text-content-muted flex items-center justify-between pt-2 border-t border-edge/60">
            <span>Across all reseller portfolios</span>
            <NavLink to="/platform/clients" className="text-brand hover:underline">Manage &rarr;</NavLink>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Total Workspaces</span>
            <div className="p-2 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-800/40">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.totalOrganizations ?? 0}
          </div>
          <div className="text-xs text-content-muted flex items-center justify-between pt-2 border-t border-edge/60">
            <span>Platform + Resellers + Clients</span>
            <span className="text-emerald-400 font-medium">100% Isolated</span>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Platform Users</span>
            <div className="p-2 rounded-lg bg-indigo-950/40 text-indigo-400 border border-indigo-800/40">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.totalUsers ?? 0}
          </div>
          <div className="text-xs text-content-muted flex items-center justify-between pt-2 border-t border-edge/60">
            <span>Admins, Managers & Agents</span>
            <span className="text-content-muted">Role scoped</span>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Monthly Messages Sent</span>
            <div className="p-2 rounded-lg bg-purple-950/40 text-purple-400 border border-purple-800/40">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.monthlyMessagesSent?.toLocaleString() ?? 0}
          </div>
          <div className="text-xs text-content-muted flex items-center justify-between pt-2 border-t border-edge/60">
            <span>Current calendar month</span>
            <span className="text-purple-400 font-medium">Live metering</span>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted uppercase tracking-wider">Campaign Volume</span>
            <div className="p-2 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-800/40">
              <Megaphone size={18} />
            </div>
          </div>
          <div className="text-3xl font-bold text-content">
            {isLoading ? '...' : stats?.monthlyCampaignRecipients?.toLocaleString() ?? 0}
          </div>
          <div className="text-xs text-content-muted flex items-center justify-between pt-2 border-t border-edge/60">
            <span>Recipients processed this month</span>
            <span className="text-rose-400 font-medium">Batch throttled</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <NavLink
          to="/platform/resellers"
          className="bg-surface hover:bg-surface-elevated/50 border border-edge rounded-xl p-5 shadow-sm transition block space-y-2 group"
        >
          <div className="font-semibold text-content group-hover:text-brand transition flex items-center justify-between">
            <span>Reseller Partner Management</span>
            <span>&rarr;</span>
          </div>
          <p className="text-xs text-content-muted leading-relaxed">
            Provision and configure reseller accounts, assign custom quotas, and monitor child client distribution.
          </p>
        </NavLink>

        <NavLink
          to="/platform/clients"
          className="bg-surface hover:bg-surface-elevated/50 border border-edge rounded-xl p-5 shadow-sm transition block space-y-2 group"
        >
          <div className="font-semibold text-content group-hover:text-brand transition flex items-center justify-between">
            <span>Client Workspace Directory</span>
            <span>&rarr;</span>
          </div>
          <p className="text-xs text-content-muted leading-relaxed">
            View all client workspaces across the entire platform, suspend or resume organizations, and audit usage.
          </p>
        </NavLink>

        <NavLink
          to="/platform/plans"
          className="bg-surface hover:bg-surface-elevated/50 border border-edge rounded-xl p-5 shadow-sm transition block space-y-2 group"
        >
          <div className="font-semibold text-content group-hover:text-brand transition flex items-center justify-between">
            <span>Plans & Feature Gates</span>
            <span>&rarr;</span>
          </div>
          <p className="text-xs text-content-muted leading-relaxed">
            Define subscription tiers, maximum WhatsApp accounts, monthly message quotas, and CRM / automation permissions.
          </p>
        </NavLink>
      </div>
    </div>
  );
};
