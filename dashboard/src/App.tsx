import { useState, useEffect, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { useRole, type UserRole } from './hooks/useRole';
import { RoleProvider } from './components/RoleProvider';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { API_BASE_URL, type User } from './services/api';
import { clearActorState, resolveStartupValidation } from './utils/authLifecycle';
import './App.css';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Sessions = lazy(() => import('./pages/Sessions').then(m => ({ default: m.Sessions })));
const Chats = lazy(() => import('./pages/Chats').then(m => ({ default: m.Chats })));
const Webhooks = lazy(() => import('./pages/Webhooks').then(m => ({ default: m.Webhooks })));
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })));
const Logs = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const ApiKeys = lazy(() => import('./pages/ApiKeys').then(m => ({ default: m.ApiKeys })));
const MessageTester = lazy(() => import('./pages/MessageTester').then(m => ({ default: m.MessageTester })));
const Infrastructure = lazy(() => import('./pages/Infrastructure').then(m => ({ default: m.Infrastructure })));
const Plugins = lazy(() => import('./pages/Plugins'));
const Campaigns = lazy(() => import('./pages/Campaigns').then(m => ({ default: m.Campaigns })));
const Contacts = lazy(() => import('./pages/Contacts').then(m => ({ default: m.Contacts })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));

// CRM Pages
const Leads = lazy(() => import('./pages/crm/Leads').then(m => ({ default: m.Leads })));
const Pipeline = lazy(() => import('./pages/crm/Pipeline').then(m => ({ default: m.Pipeline })));
const Followups = lazy(() => import('./pages/crm/Followups').then(m => ({ default: m.Followups })));
const Tags = lazy(() => import('./pages/crm/Tags').then(m => ({ default: m.Tags })));

// Team Page
const UsersPage = lazy(() => import('./pages/team/Users').then(m => ({ default: m.Users })));

// Super Admin Platform Pages
const PlatformOverview = lazy(() => import('./pages/platform/PlatformOverview').then(m => ({ default: m.PlatformOverview })));
const Resellers = lazy(() => import('./pages/platform/Resellers').then(m => ({ default: m.Resellers })));
const Clients = lazy(() => import('./pages/platform/Clients').then(m => ({ default: m.Clients })));
const Plans = lazy(() => import('./pages/platform/Plans').then(m => ({ default: m.Plans })));

// Reseller Pages
const ResellerOverview = lazy(() => import('./pages/reseller/ResellerOverview').then(m => ({ default: m.ResellerOverview })));
const ResellerClients = lazy(() => import('./pages/reseller/ResellerClients').then(m => ({ default: m.ResellerClients })));
const ResellerUsage = lazy(() => import('./pages/reseller/ResellerUsage').then(m => ({ default: m.ResellerUsage })));

// Workspace Settings Page
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings').then(m => ({ default: m.OrganizationSettings })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function AppRoutes({ onLogout }: { onLogout: () => void }) {
  const { role, canManageUsers } = useRole();
  const { platformRole } = useWorkspace();
  const isSuperAdmin = platformRole === 'super_admin';
  const isResellerAdmin = platformRole === 'reseller_admin' || isSuperAdmin;

  return (
    <Routes>
      <Route path="/" element={<Layout onLogout={onLogout} userRole={role} />}>
        {/* Core Workspace Routes */}
        <Route index element={<Dashboard />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="chats" element={<Chats />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="crm/leads" element={<Leads />} />
        <Route path="crm/pipeline" element={<Pipeline />} />
        <Route path="crm/followups" element={<Followups />} />
        <Route path="crm/tags" element={<Tags />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="templates" element={<Templates />} />
        <Route path="reports" element={<Reports />} />
        {canManageUsers && <Route path="team/users" element={<UsersPage />} />}
        <Route path="settings/organization" element={<OrganizationSettings />} />
        <Route path="webhooks" element={<Webhooks />} />
        {role === 'admin' && <Route path="api-keys" element={<ApiKeys />} />}
        <Route path="logs" element={<Logs />} />
        <Route path="message-center" element={<MessageTester />} />
        <Route path="message-tester" element={<Navigate to="/message-center" replace />} />
        {role === 'admin' && <Route path="infrastructure" element={<Infrastructure />} />}
        {role === 'admin' && <Route path="plugins" element={<Plugins />} />}

        {/* Super Admin Platform Routes */}
        {isSuperAdmin && (
          <>
            <Route path="platform/overview" element={<PlatformOverview />} />
            <Route path="platform/resellers" element={<Resellers />} />
            <Route path="platform/clients" element={<Clients />} />
            <Route path="platform/plans" element={<Plans />} />
          </>
        )}

        {/* Reseller Routes */}
        {isResellerAdmin && (
          <>
            <Route path="reseller/overview" element={<ResellerOverview />} />
            <Route path="reseller/clients" element={<ResellerClients />} />
            <Route path="reseller/usage" element={<ResellerUsage />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppContent() {
  const savedKey = sessionStorage.getItem('openwa_api_key');
  const [isAuthenticated, setIsAuthenticated] = useState(!!savedKey);
  const [, setApiKey] = useState(savedKey || '');
  const { setRole, setUser } = useRole();

  const handleLogin = async (token: string, userObj?: User, userRole?: string) => {
    setApiKey(token);
    sessionStorage.setItem('openwa_api_key', token);

    if (userObj) {
      setUser(userObj);
      setRole((userObj.role || userRole || 'agent') as UserRole);
    } else if (userRole) {
      setRole(userRole as UserRole);
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': token,
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user) setUser(data.user);
          setRole(data.role as UserRole);
        }
      } catch {
        setRole('viewer');
      }
    }

    setIsAuthenticated(true);
  };

  const handleLogout = useCallback(() => {
    setApiKey('');
    setIsAuthenticated(false);
    setRole(null);
    setUser(null);
    sessionStorage.removeItem('openwa_api_key');
    clearActorState(queryClient);
  }, [setRole, setUser]);

  useEffect(() => {
    if (!savedKey) return;

    fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': savedKey,
        Authorization: `Bearer ${savedKey}`,
      },
    })
      .then(async res => {
        const data = await res.json().catch(() => null);
        const decision = resolveStartupValidation(res.status, data);
        if (decision.action === 'logout') {
          handleLogout();
        } else if (decision.action === 'role') {
          setRole(decision.role);
          if (data?.user) setUser(data.user);
        }
      })
      .catch(() => {
        // Network failure: keep cached state
      });
  }, [savedKey, setRole, setUser, handleLogout]);

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (!isAuthenticated) {
    return (
      <Suspense fallback={loadingFallback}>
        <Login onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={loadingFallback}>
              <AppRoutes onLogout={handleLogout} />
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
