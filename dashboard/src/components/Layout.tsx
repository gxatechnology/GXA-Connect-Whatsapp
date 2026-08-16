import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Webhook,
  Key,
  FileText,
  ClipboardList,
  LogOut,
  Send,
  Server,
  Puzzle,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Languages,
  Megaphone,
  Users,
  BarChart3,
  UserCheck,
  Columns,
  Clock,
  Tag,
  Shield,
  ChevronDown,
  Building,
  Layers,
  Settings,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useRole, type UserRole } from '../hooks/useRole';
import { useWorkspace } from '../context/WorkspaceContext';
import { languageOptions, resolveSupportedLanguage, rtlLanguages } from '../i18n';
import { useSessionStatsQuery } from '../hooks/queries';
import { StatusBadge } from './common/StatusBadge';
import { ChangePasswordModal } from './auth/ChangePasswordModal';
import { WorkspaceSelector } from './WorkspaceSelector';
import './Layout.css';

interface LayoutProps {
  onLogout: () => void;
  userRole: UserRole | null;
}

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  defaultLabel: string;
  section: string;
  adminOnly?: boolean;
  managerOrAdmin?: boolean;
  platformOnly?: boolean;
  resellerOnly?: boolean;
}

const allNavItems: NavItem[] = [
  // Super Admin Platform Console
  { to: '/platform/overview', icon: LayoutDashboard, labelKey: 'platform.overview', defaultLabel: 'Platform Overview', section: 'PLATFORM', platformOnly: true },
  { to: '/platform/resellers', icon: Building, labelKey: 'platform.resellers', defaultLabel: 'Resellers', section: 'PLATFORM', platformOnly: true },
  { to: '/platform/clients', icon: Users, labelKey: 'platform.clients', defaultLabel: 'Client Orgs', section: 'PLATFORM', platformOnly: true },
  { to: '/platform/plans', icon: Layers, labelKey: 'platform.plans', defaultLabel: 'Plans & Limits', section: 'PLATFORM', platformOnly: true },

  // Reseller Console
  { to: '/reseller/overview', icon: LayoutDashboard, labelKey: 'reseller.overview', defaultLabel: 'Reseller Overview', section: 'RESELLER', resellerOnly: true },
  { to: '/reseller/clients', icon: Users, labelKey: 'reseller.clients', defaultLabel: 'My Clients', section: 'RESELLER', resellerOnly: true },
  { to: '/reseller/usage', icon: BarChart3, labelKey: 'reseller.usage', defaultLabel: 'Client Usage', section: 'RESELLER', resellerOnly: true },

  // Workspace Client Operating Suite
  { to: '/', icon: LayoutDashboard, labelKey: 'dashboard.title', defaultLabel: 'Dashboard', section: 'OVERVIEW', adminOnly: false },
  { to: '/chats', icon: MessageSquare, labelKey: 'chats.title', defaultLabel: 'Inbox', section: 'COMMUNICATION', adminOnly: false },
  { to: '/contacts', icon: Users, labelKey: 'contacts.title', defaultLabel: 'Contacts', section: 'COMMUNICATION', adminOnly: false },
  { to: '/sessions', icon: Smartphone, labelKey: 'sessions.title', defaultLabel: 'WhatsApp Accounts', section: 'COMMUNICATION', adminOnly: false },
  { to: '/crm/leads', icon: UserCheck, labelKey: 'crm.leads', defaultLabel: 'Leads', section: 'CRM', adminOnly: false },
  { to: '/crm/pipeline', icon: Columns, labelKey: 'crm.pipeline', defaultLabel: 'Pipeline', section: 'CRM', adminOnly: false },
  { to: '/crm/followups', icon: Clock, labelKey: 'crm.followups', defaultLabel: 'Follow-ups', section: 'CRM', adminOnly: false },
  { to: '/crm/tags', icon: Tag, labelKey: 'crm.tags', defaultLabel: 'Tags', section: 'CRM', adminOnly: false },
  { to: '/campaigns', icon: Megaphone, labelKey: 'campaigns.title', defaultLabel: 'Campaigns', section: 'CAMPAIGNS', adminOnly: false },
  { to: '/templates', icon: ClipboardList, labelKey: 'templates.title', defaultLabel: 'Templates', section: 'CAMPAIGNS', adminOnly: false },
  { to: '/reports', icon: BarChart3, labelKey: 'reports.title', defaultLabel: 'Reports', section: 'ANALYTICS', adminOnly: false },
  { to: '/team/users', icon: Shield, labelKey: 'team.users', defaultLabel: 'Team Members', section: 'TEAM', adminOnly: false, managerOrAdmin: true },
  { to: '/settings/organization', icon: Settings, labelKey: 'settings.organization', defaultLabel: 'Plan & Workspace', section: 'WORKSPACE', adminOnly: false },
  { to: '/message-center', icon: Send, labelKey: 'messageTester.title', defaultLabel: 'Message Center', section: 'DEVELOPER', adminOnly: false },
  { to: '/api-keys', icon: Key, labelKey: 'apiKeys.title', defaultLabel: 'API Tokens', section: 'DEVELOPER', adminOnly: true },
  { to: '/webhooks', icon: Webhook, labelKey: 'webhooks.title', defaultLabel: 'Webhooks', section: 'DEVELOPER', adminOnly: false },
  { to: '/plugins', icon: Puzzle, labelKey: 'plugins.title', defaultLabel: 'Plugins', section: 'DEVELOPER', adminOnly: true },
  { to: '/logs', icon: FileText, labelKey: 'logs.title', defaultLabel: 'Audit Logs', section: 'DEVELOPER', adminOnly: false },
  { to: '/infrastructure', icon: Server, labelKey: 'infra.title', defaultLabel: 'Infrastructure', section: 'SYSTEM', adminOnly: true },
];

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

export function Layout({ onLogout, userRole }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, canManageUsers } = useRole();
  const { platformRole } = useWorkspace();
  const ThemeIcon = themeIcons[theme];
  const themeLabel = t(`theme.${theme}`);

  const { data: sessionStats } = useSessionStatsQuery();
  const readyAccounts = sessionStats?.ready ?? 0;

  const isSuperAdmin = platformRole === 'super_admin' || user?.platformRole === 'super_admin';
  const isResellerAdmin = platformRole === 'reseller_admin' || user?.platformRole === 'reseller_admin';

  const navItems = allNavItems.filter(item => {
    if (item.platformOnly && !isSuperAdmin) return false;
    if (item.resellerOnly && !isResellerAdmin && !isSuperAdmin) return false;
    if (item.adminOnly && userRole !== 'admin') return false;
    if (item.managerOrAdmin && !canManageUsers) return false;
    return true;
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsCollapsed(c => !c);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    document.documentElement.dir = rtlLanguages.includes(lng as any) ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
    setIsLanguageMenuOpen(false);
  };

  const currentLang = resolveSupportedLanguage(i18n.language);
  const languageLabel = languageOptions.find(o => o.value === currentLang)?.label || currentLang;

  const currentItem = navItems.find(item =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  ) || { section: 'GXA CONNECT', labelKey: 'dashboard.title', defaultLabel: 'Dashboard' };

  const handleNavClick = () => {
    if (isMobile) setIsMobileOpen(false);
  };

  const userDisplayName = user?.fullName || (userRole ? userRole.toUpperCase() : 'DEVELOPER');
  const userInitials = userDisplayName.substring(0, 2).toUpperCase();

  return (
    <div className={`app-layout ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Mobile Top Bar */}
      {isMobile && (
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setIsMobileOpen(o => !o)} aria-label="Toggle Navigation">
            {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="mobile-brand">
            <img src="/GXA Logo Final.png" alt="GXA Connect" className="mobile-logo-img" />
            <span className="mobile-brand-text">GXA CONNECT</span>
          </div>
          <div className="flex items-center gap-2">
            <WorkspaceSelector />
          </div>
        </div>
      )}

      {/* Backdrop for Mobile Navigation Drawer */}
      {isMobile && isMobileOpen && (
        <div className="mobile-backdrop" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Primary Left Navigation Sidebar */}
      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Sidebar Navigation"
      >
        <div className="sidebar-header">
          <NavLink to="/" className="brand-link" onClick={handleNavClick}>
            <div className="brand-logo-wrap">
              <img src="/GXA Logo Final.png" alt="GXA Technologies" className="brand-logo-img" />
            </div>
            {!isCollapsed && (
              <div className="brand-text-block">
                <span className="brand-title">GXA CONNECT</span>
                <span className="brand-subtitle">Operating Suite</span>
              </div>
            )}
          </NavLink>
          {!isMobile && (
            <button
              className="collapse-toggle-btn"
              onClick={() => setIsCollapsed(c => !c)}
              title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              aria-label="Toggle sidebar collapse"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Navigation Item Tree */}
        <nav className="sidebar-nav" role="navigation">
          {navItems.map(({ to, icon: Icon, labelKey, defaultLabel, section }, index) => {
            const showSection = !isCollapsed && (index === 0 || navItems[index - 1]?.section !== section);
            const label = t(labelKey, { defaultValue: defaultLabel });
            return (
              <div className="nav-block" key={to}>
                {showSection && <div className="nav-section-label">{section}</div>}
                <NavLink
                  to={to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  end={to === '/' || to === '/platform/overview' || to === '/reseller/overview'}
                  onClick={handleNavClick}
                  title={isCollapsed ? label : undefined}
                >
                  <Icon size={19} className="nav-icon" />
                  {!isCollapsed && <span className="nav-label">{label}</span>}
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="language-menu" ref={languageMenuRef}>
            <button
              className="theme-toggle-btn"
              onClick={() => setIsLanguageMenuOpen(open => !open)}
              title={t('common.language')}
              aria-label={t('common.language')}
              aria-haspopup="menu"
              aria-expanded={isLanguageMenuOpen}
            >
              <Languages size={17} />
              {!isCollapsed && <span>{languageLabel}</span>}
            </button>
            {isLanguageMenuOpen && (
              <div className="language-menu-list" role="menu" aria-label={t('common.language')}>
                {languageOptions.map(option => (
                  <button
                    key={option.value}
                    className={`language-menu-item ${option.value === currentLang ? 'active' : ''}`}
                    onClick={() => changeLanguage(option.value)}
                    role="menuitemradio"
                    aria-checked={option.value === currentLang}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="appearance-menu">
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              title={t('theme.toggleTo', { value: t(resolvedTheme === 'dark' ? 'theme.light' : 'theme.dark') })}
              aria-label={t('theme.toggleTo', { value: t(resolvedTheme === 'dark' ? 'theme.light' : 'theme.dark') })}
            >
              <span className="appearance-button-cue" aria-hidden="true">
                <ThemeIcon size={16} />
              </span>
              {!isCollapsed && <span>{themeLabel}</span>}
            </button>
          </div>
          <button className="logout-btn" onClick={onLogout} title={isCollapsed ? t('common.logout') : undefined}>
            <LogOut size={18} />
            {!isCollapsed && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content & Application Shell Header */}
      <div className={`main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'is-mobile' : ''}`}>
        {!isMobile && (
          <header className="app-top-header">
            <div className="top-header-left">
              <div className="breadcrumb-trail">
                <span className="breadcrumb-section">{currentItem.section}</span>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-current">
                  {t(currentItem.labelKey, { defaultValue: currentItem.defaultLabel })}
                </span>
              </div>
            </div>

            <div className="top-header-right">
              {/* Multi-Tenant Workspace Selector */}
              <WorkspaceSelector />

              <div className="connection-status-widget" title="Live WhatsApp connection status">
                <StatusBadge
                  status={readyAccounts > 0 ? 'connected' : 'disconnected'}
                  label={readyAccounts > 0 ? `${readyAccounts} Account${readyAccounts > 1 ? 's' : ''} Connected` : 'No Connected Account'}
                  size="sm"
                />
              </div>

              <div className="top-header-divider" />

              {/* User Dropdown */}
              <div className="top-user-menu" ref={userMenuRef}>
                <button
                  type="button"
                  className="user-profile-btn"
                  onClick={() => setIsUserMenuOpen(o => !o)}
                  aria-expanded={isUserMenuOpen}
                >
                  <div className="user-avatar-badge">{userInitials}</div>
                  <span>{userDisplayName}</span>
                  <span className="user-role-tag">{userRole || 'USER'}</span>
                  <ChevronDown size={14} />
                </button>

                {isUserMenuOpen && (
                  <div className="user-dropdown-panel">
                    <div className="user-dropdown-header">
                      <div className="dropdown-user-name">{userDisplayName}</div>
                      {user?.email && <div className="dropdown-user-email">{user.email}</div>}
                    </div>
                    {user && (
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setShowPasswordModal(true);
                        }}
                      >
                        <Key size={14} /> Change Password
                      </button>
                    )}
                    <button
                      type="button"
                      className="dropdown-item-btn"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      style={{ color: '#ef4444' }}
                    >
                      <LogOut size={14} /> {t('common.logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        <main className="app-content-body" role="main">
          <Outlet />
        </main>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
