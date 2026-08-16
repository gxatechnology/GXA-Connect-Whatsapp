import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sessionApi,
  webhookApi,
  templateApi,
  apiKeyApi,
  auditApi,
  infraApi,
  pluginsApi,
  pluginInstancesApi,
  statsApi,
  crmApi,
  usersApi,
  authApi,
  type Webhook,
  type WebhookFilters,
  type TemplatePayload,
  type StatsPeriod,
  type CreateInstanceInput,
  type UpdateInstanceInput,
  type CrmLead,
  type CrmFollowup,
} from '../services/api';

// ── Query Keys ────────────────────────────────────────────────────────

export const queryKeys = {
  sessions: ['sessions'] as const,
  sessionStats: ['sessions', 'stats'] as const,
  sessionGroups: (sessionId: string) => ['sessions', sessionId, 'groups'] as const,
  sessionChats: (sessionId: string) => ['sessions', sessionId, 'chats'] as const,
  webhooks: ['webhooks'] as const,
  templates: (sessionId: string) => ['sessions', sessionId, 'templates'] as const,
  apiKeys: ['apiKeys'] as const,
  logs: (params: { severity?: string; page: number; limit: number }) => ['logs', params] as const,
  infraStatus: ['infra', 'status'] as const,
  plugins: ['plugins'] as const,
  pluginInstances: (pluginId: string) => ['plugins', pluginId, 'instances'] as const,
  engines: ['engines'] as const,
  currentEngine: ['engines', 'current'] as const,
  statsOverview: ['stats', 'overview'] as const,
  statsMessages: (period: string) => ['stats', 'messages', period] as const,
  crmLeads: (params?: Record<string, unknown>) => ['crm', 'leads', params] as const,
  crmLead: (id: string) => ['crm', 'lead', id] as const,
  crmLeadByPhone: (phone: string, sessionId?: string) => ['crm', 'leadByPhone', phone, sessionId] as const,
  crmTags: ['crm', 'tags'] as const,
  crmFollowups: (params?: Record<string, unknown>) => ['crm', 'followups', params] as const,
  crmNotes: (leadId: string) => ['crm', 'notes', leadId] as const,
  crmActivity: (leadId: string) => ['crm', 'activity', leadId] as const,
  crmCampaignHistory: (leadId: string) => ['crm', 'campaignHistory', leadId] as const,
  users: ['users'] as const,
  authMe: ['auth', 'me'] as const,
};

// ── Session Queries ───────────────────────────────────────────────────

export function useSessionsQuery() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: sessionApi.list,
    staleTime: 30_000,
  });
}

export function useSessionStatsQuery() {
  return useQuery({
    queryKey: queryKeys.sessionStats,
    queryFn: sessionApi.getStats,
    staleTime: 30_000,
  });
}

export function useSessionGroupsQuery(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.sessionGroups(sessionId),
    queryFn: () => sessionApi.getGroups(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 60_000,
  });
}

export function useSessionChatsQuery(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.sessionChats(sessionId),
    queryFn: () => sessionApi.getChats(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 60_000,
  });
}

export function useStopSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.stop(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

// ── Webhook Queries ───────────────────────────────────────────────────

export function useWebhooksQuery() {
  return useQuery({
    queryKey: queryKeys.webhooks,
    queryFn: webhookApi.listAll,
    staleTime: 30_000,
    // Normalize `events` to an array at the data boundary so every consumer (list render + edit
    // modal) can trust the declared string[] shape. A malformed payload then renders as no tags
    // instead of taking down the whole SPA via events.map() in the ErrorBoundary.
    select: webhooks => webhooks.map(w => ({ ...w, events: Array.isArray(w.events) ? w.events : [] })),
  });
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; url: string; events: string[]; filters?: WebhookFilters | null }) =>
      webhookApi.create(params.sessionId, { url: params.url, events: params.events, filters: params.filters }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string; data: Partial<Webhook> }) =>
      webhookApi.update(params.sessionId, params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string }) => webhookApi.delete(params.sessionId, params.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

// ── Template Queries ─────────────────────────────────────────────────────────

export function useTemplatesQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.templates(sessionId),
    queryFn: () => templateApi.list(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 30_000,
  });
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; data: TemplatePayload }) =>
      templateApi.create(params.sessionId, params.data),
    onSuccess: (_template, params) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates(params.sessionId) });
    },
  });
}

export function useUpdateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string; data: Partial<TemplatePayload> }) =>
      templateApi.update(params.sessionId, params.id, params.data),
    onSuccess: (_template, params) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates(params.sessionId) });
    },
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string }) => templateApi.delete(params.sessionId, params.id),
    onSuccess: (_template, params) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates(params.sessionId) });
    },
  });
}

// ── API Key Queries ───────────────────────────────────────────────────

export function useApiKeysQuery() {
  return useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: apiKeyApi.list,
    staleTime: 30_000,
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      role: string;
      allowedIps?: string[];
      allowedSessions?: string[];
      expiresAt?: string;
    }) => apiKeyApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useDeleteApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeyApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeyApi.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

// ── Logs Queries ──────────────────────────────────────────────────────

export function useLogsQuery(params: { severity?: string; page: number; limit: number }) {
  return useQuery({
    queryKey: queryKeys.logs(params),
    queryFn: () =>
      auditApi.list({
        severity: params.severity,
        limit: params.limit,
        offset: (params.page - 1) * params.limit,
      }),
    staleTime: 15_000,
  });
}

// ── Infrastructure Queries ────────────────────────────────────────────

export function useInfraStatusQuery() {
  return useQuery({
    queryKey: queryKeys.infraStatus,
    queryFn: infraApi.getStatus,
    staleTime: 30_000,
  });
}

export function useInfraConfigQuery() {
  return useQuery({
    queryKey: ['infra', 'config'],
    queryFn: infraApi.getConfig,
    staleTime: 30_000,
  });
}

// ── Plugin Queries ────────────────────────────────────────────────────

export function usePluginsQuery() {
  return useQuery({
    queryKey: queryKeys.plugins,
    queryFn: pluginsApi.list,
    staleTime: 30_000,
  });
}

export function usePluginInstancesQuery(pluginId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.pluginInstances(pluginId),
    queryFn: () => pluginInstancesApi.list(pluginId),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateInstanceMutation(pluginId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInstanceInput) => pluginInstancesApi.create(pluginId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pluginInstances(pluginId) });
    },
  });
}

export function useRegenerateInstanceSecretMutation(pluginId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => pluginInstancesApi.regenerateSecret(pluginId, instanceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pluginInstances(pluginId) });
    },
  });
}

export function useUpdateInstanceMutation(pluginId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { instanceId: string; body: UpdateInstanceInput }) =>
      pluginInstancesApi.update(pluginId, params.instanceId, params.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pluginInstances(pluginId) });
    },
  });
}

export function useDeleteInstanceMutation(pluginId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => pluginInstancesApi.remove(pluginId, instanceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pluginInstances(pluginId) });
    },
  });
}

export function useEnginesQuery() {
  return useQuery({
    queryKey: queryKeys.engines,
    queryFn: pluginsApi.getEngines,
    staleTime: 60_000,
  });
}

export function useCurrentEngineQuery() {
  return useQuery({
    queryKey: queryKeys.currentEngine,
    queryFn: pluginsApi.getCurrentEngine,
    staleTime: 60_000,
  });
}

// ── Stats Queries ─────────────────────────────────────────────────────
// /stats/* is ADMIN-only; a non-admin key gets 403 → don't retry, let the UI fall back gracefully.

export function useStatsOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.statsOverview,
    queryFn: statsApi.getOverview,
    staleTime: 30_000,
    retry: false,
  });
}

export function useStatsMessagesQuery(period: StatsPeriod) {
  return useQuery({
    queryKey: queryKeys.statsMessages(period),
    queryFn: () => statsApi.getMessages(period),
    staleTime: 30_000,
    retry: false,
  });
}

// ── CRM Queries & Mutations ──────────────────────────────────────────

export function useCrmLeadsQuery(query?: {
  search?: string;
  stage?: string;
  source?: string;
  assignedUserId?: string;
  tagId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.crmLeads(query),
    queryFn: () => crmApi.getLeads(query),
    staleTime: 15_000,
  });
}

export function useCrmLeadQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.crmLead(id),
    queryFn: () => crmApi.getLead(id),
    enabled: !!id && enabled,
    staleTime: 15_000,
  });
}

export function useCrmLeadByPhoneQuery(phone: string, sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.crmLeadByPhone(phone, sessionId),
    queryFn: () => crmApi.getLeadByPhone(phone, sessionId),
    enabled: !!phone && enabled,
    staleTime: 30_000,
  });
}

export function useCreateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof crmApi.createLead>[0]) => crmApi.createLead(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useUpdateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CrmLead> }) => crmApi.updateLead(id, body),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['crm'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmLead(id) });
    },
  });
}

export function useDeleteLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteLead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useCrmTagsQuery() {
  return useQuery({
    queryKey: queryKeys.crmTags,
    queryFn: crmApi.getTags,
    staleTime: 30_000,
  });
}

export function useCreateTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color?: string }) => crmApi.createTag(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmTags });
    },
  });
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteTag(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmTags });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
  });
}

export function useAddTagToLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, tagId }: { leadId: string; tagId: string }) => crmApi.addTagToLead(leadId, tagId),
    onSuccess: (_, { leadId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmLead(leadId) });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
  });
}

export function useRemoveTagFromLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, tagId }: { leadId: string; tagId: string }) =>
      crmApi.removeTagFromLead(leadId, tagId),
    onSuccess: (_, { leadId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmLead(leadId) });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
  });
}

export function useCrmNotesQuery(leadId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.crmNotes(leadId),
    queryFn: () => crmApi.getNotes(leadId),
    enabled: !!leadId && enabled,
  });
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, content }: { leadId: string; content: string }) =>
      crmApi.createNote(leadId, content),
    onSuccess: (_, { leadId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmNotes(leadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmLead(leadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmActivity(leadId) });
    },
  });
}

export function useDeleteNoteMutation(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmNotes(leadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmLead(leadId) });
    },
  });
}

export function useCrmFollowupsQuery(query?: {
  view?: 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';
  assignedUserId?: string;
  leadId?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.crmFollowups(query),
    queryFn: () => crmApi.getFollowups(query),
    staleTime: 15_000,
  });
}

export function useCreateFollowupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof crmApi.createFollowup>[0]) => crmApi.createFollowup(body),
    onSuccess: (_, { leadId }) => {
      void queryClient.invalidateQueries({ queryKey: ['crm', 'followups'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmLead(leadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crmActivity(leadId) });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
  });
}

export function useUpdateFollowupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CrmFollowup> }) =>
      crmApi.updateFollowup(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm', 'followups'] });
      void queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useDeleteFollowupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteFollowup(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm', 'followups'] });
      void queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useCrmActivityQuery(leadId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.crmActivity(leadId),
    queryFn: () => crmApi.getActivity(leadId),
    enabled: !!leadId && enabled,
    staleTime: 15_000,
  });
}

export function useCrmCampaignHistoryQuery(leadId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.crmCampaignHistory(leadId),
    queryFn: () => crmApi.getCampaignHistory(leadId),
    enabled: !!leadId && enabled,
    staleTime: 30_000,
  });
}

// ── User Management Queries ──────────────────────────────────────────

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: usersApi.list,
    staleTime: 30_000,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { fullName: string; email: string; password: string; role?: string }) =>
      usersApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { fullName?: string; role?: string; status?: string } }) =>
      usersApi.update(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usersApi.resetPassword(id, newPassword),
  });
}

export function useAuthMeQuery() {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: authApi.me,
    staleTime: 60_000,
    retry: false,
  });
}

