import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BarChart3, AlertCircle, Calendar } from 'lucide-react';

interface ClientUsageEntry {
  organizationId: string;
  organizationName: string;
  usage: {
    messagesSent: number;
    campaignRecipientsProcessed: number;
    periodStart: string;
    periodEnd: string;
  };
  limits: {
    maxMonthlyMessages: number | null;
    maxCampaignRecipients: number | null;
    planName: string | null;
  };
}

export const ResellerUsage: React.FC = () => {
  const { token } = useAuth();
  const [usages, setUsages] = useState<ClientUsageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/reseller/usage', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error('Failed to load client usage report');
        }
        const data = await res.json();
        setUsages(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsage();
  }, [token]);

  const calculatePct = (current: number, max: number | null) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((current / max) * 100));
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return 'bg-rose-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-brand';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/50 uppercase tracking-wider">
            Reseller Partner
          </span>
        </div>
        <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2.5">
          <BarChart3 className="text-purple-400" size={24} /> Client Usage Accounting
        </h1>
        <p className="text-xs text-content-muted mt-1">
          Monitor message throughput and batch campaign recipient consumption across your client organizations for the current calendar month.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-edge rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted/60 text-content-muted uppercase tracking-wider text-[10px] border-b border-edge">
              <tr>
                <th className="py-3 px-4 font-semibold">Client Organization</th>
                <th className="py-3 px-4 font-semibold">Tier Plan</th>
                <th className="py-3 px-4 font-semibold">Monthly Messages</th>
                <th className="py-3 px-4 font-semibold">Campaign Volume</th>
                <th className="py-3 px-4 font-semibold">Billing Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50 text-content">
              {usages.map(u => {
                const msgPct = calculatePct(u.usage.messagesSent, u.limits.maxMonthlyMessages);
                const cmpPct = calculatePct(u.usage.campaignRecipientsProcessed, u.limits.maxCampaignRecipients);

                return (
                  <tr key={u.organizationId} className="hover:bg-surface-elevated/40 transition">
                    <td className="py-3.5 px-4 font-medium">
                      <div className="font-semibold text-content">{u.organizationName}</div>
                      <div className="text-[10px] text-content-muted font-mono">{u.organizationId}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-surface-base border border-edge text-[11px] font-medium">
                        {u.limits.planName || 'Standard'}
                      </span>
                    </td>

                    {/* Messages Progress */}
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold">{u.usage.messagesSent.toLocaleString()}</span>
                        <span className="text-content-muted">
                          {u.limits.maxMonthlyMessages ? `/ ${u.limits.maxMonthlyMessages.toLocaleString()}` : 'Unlimited'}
                        </span>
                      </div>
                      {u.limits.maxMonthlyMessages ? (
                        <div className="w-full h-1.5 bg-surface-base border border-edge/60 rounded-full overflow-hidden">
                          <div className={`h-full ${getProgressColor(msgPct)} transition-all`} style={{ width: `${msgPct}%` }} />
                        </div>
                      ) : (
                        <div className="w-full h-1.5 bg-brand/30 rounded-full" />
                      )}
                    </td>

                    {/* Campaign Volume Progress */}
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold">{u.usage.campaignRecipientsProcessed.toLocaleString()}</span>
                        <span className="text-content-muted">
                          {u.limits.maxCampaignRecipients ? `/ ${u.limits.maxCampaignRecipients.toLocaleString()}` : 'Unlimited'}
                        </span>
                      </div>
                      {u.limits.maxCampaignRecipients ? (
                        <div className="w-full h-1.5 bg-surface-base border border-edge/60 rounded-full overflow-hidden">
                          <div className={`h-full ${getProgressColor(cmpPct)} transition-all`} style={{ width: `${cmpPct}%` }} />
                        </div>
                      ) : (
                        <div className="w-full h-1.5 bg-rose-500/30 rounded-full" />
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-content-muted text-[11px] flex items-center gap-1.5">
                      <Calendar size={13} className="text-content-muted/60" />
                      <span>Current Month</span>
                    </td>
                  </tr>
                );
              })}

              {usages.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-content-muted">
                    No active clients with usage recorded this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
