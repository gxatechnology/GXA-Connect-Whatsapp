import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export const WorkspaceSelector: React.FC = () => {
  const { currentOrganization, workspaces, switchWorkspace, platformRole } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }
    try {
      setIsSwitching(true);
      await switchWorkspace(orgId);
    } catch (err) {
      console.error(err);
      setIsSwitching(false);
    }
  };

  const getBadgeStyle = (type?: string) => {
    switch (type) {
      case 'platform':
        return 'bg-purple-950/60 text-purple-300 border-purple-800/50';
      case 'reseller':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/50';
      default:
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50';
    }
  };

  const filteredWorkspaces = workspaces.filter(w =>
    w.organization.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.organization.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-base border border-edge hover:border-edge-strong transition text-xs text-content focus:outline-none"
        title="Switch active organization workspace"
      >
        <div className="w-5 h-5 rounded bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-[10px]">
          {currentOrganization?.name?.charAt(0).toUpperCase() || 'W'}
        </div>
        <div className="text-left font-medium max-w-[130px] truncate">
          {currentOrganization?.name || 'GXA Workspace'}
        </div>
        <span
          className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getBadgeStyle(
            currentOrganization?.type
          )}`}
        >
          {currentOrganization?.type === 'platform'
            ? 'Platform'
            : currentOrganization?.type === 'reseller'
            ? 'Reseller'
            : 'Client'}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-content-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-surface-base border border-edge rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="p-2.5 border-b border-edge/60 bg-surface-muted/40">
            <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
              Switch Workspace
            </div>
            {workspaces.length > 4 && (
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search workspaces..."
                className="w-full px-2.5 py-1.5 text-xs bg-surface border border-edge rounded-md text-content placeholder:text-content-muted/60 focus:outline-none focus:border-brand"
                autoFocus
              />
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {filteredWorkspaces.map(ws => {
              const isSelected = ws.organization.id === currentOrganization?.id;
              return (
                <button
                  key={ws.organization.id}
                  onClick={() => handleSelect(ws.organization.id)}
                  disabled={isSwitching}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs transition ${
                    isSelected
                      ? 'bg-brand/10 text-brand font-semibold border border-brand/20'
                      : 'text-content hover:bg-surface-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-5 h-5 rounded bg-surface border border-edge flex items-center justify-center font-bold text-[10px]">
                      {ws.organization.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="truncate font-medium">{ws.organization.name}</div>
                      <div className="text-[10px] text-content-muted truncate">/{ws.organization.slug}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border ${getBadgeStyle(
                        ws.organization.type
                      )}`}
                    >
                      {ws.organization.type}
                    </span>
                    {isSelected && (
                      <svg className="w-3.5 h-3.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredWorkspaces.length === 0 && (
              <div className="py-6 text-center text-xs text-content-muted">
                No matching workspaces found.
              </div>
            )}
          </div>

          {platformRole === 'super_admin' && (
            <div className="p-2 border-t border-edge/60 bg-surface-muted/30 text-center">
              <a
                href="/platform/overview"
                className="text-[11px] text-brand hover:underline font-medium inline-flex items-center gap-1"
              >
                Open Super Admin Platform Console &rarr;
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
