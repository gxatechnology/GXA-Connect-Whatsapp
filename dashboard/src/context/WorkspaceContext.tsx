import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'platform' | 'reseller' | 'client';
  status: 'active' | 'suspended' | 'archived';
  parentOrganizationId?: string | null;
  ownerUserId?: string | null;
  planId?: string | null;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EffectiveLimits {
  planId: string | null;
  planName: string | null;
  maxUsers: number | null;
  maxWhatsAppAccounts: number | null;
  maxContacts: number | null;
  maxMonthlyMessages: number | null;
  maxCampaignRecipients: number | null;
  maxClientOrganizations: number | null;
  apiAccess: boolean;
  crmEnabled: boolean;
  automationEnabled: boolean;
  reportsEnabled: boolean;
}

export interface MonthlyUsage {
  messagesSent: number;
  campaignRecipientsProcessed: number;
  periodStart: string;
  periodEnd: string;
}

export interface WorkspaceMembership {
  organization: Organization;
  role: string;
}

interface WorkspaceContextType {
  currentOrganization: Organization | null;
  currentRole: string;
  platformRole: string;
  limits: EffectiveLimits | null;
  usage: MonthlyUsage | null;
  workspaces: WorkspaceMembership[];
  isLoading: boolean;
  switchWorkspace: (organizationId: string) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('agent');
  const [platformRole, setPlatformRole] = useState<string>('user');
  const [limits, setLimits] = useState<EffectiveLimits | null>(null);
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchWorkspaceData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [meRes, listRes] = await Promise.all([
        fetch('/api/organizations/me', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/organizations/my-workspaces', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentOrganization(meData.organization);
        setCurrentRole(meData.role || 'agent');
        setPlatformRole(meData.platformRole || user?.platformRole || 'user');
        setLimits(meData.limits);
        setUsage(meData.usage);
      }

      if (listRes.ok) {
        const listData = await listRes.json();
        setWorkspaces(Array.isArray(listData) ? listData : []);
      }
    } catch (err) {
      console.error('Failed to load workspace data', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  const switchWorkspace = async (organizationId: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to switch workspace');
      }

      await fetchWorkspaceData();
      window.location.reload();
    } catch (err) {
      console.error('Switch workspace failed', err);
      throw err;
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentOrganization,
        currentRole,
        platformRole,
        limits,
        usage,
        workspaces,
        isLoading,
        switchWorkspace,
        refreshWorkspace: fetchWorkspaceData,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
