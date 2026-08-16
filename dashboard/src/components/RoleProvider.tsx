import { useState, useCallback, type ReactNode } from 'react';
import type { UserRole, RoleContextType } from '../types/role';
import type { User } from '../services/api';
import { RoleContext } from '../hooks/useRole';

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem('openwa_user_role');
    return (saved as UserRole) || null;
  });

  const [user, setUserState] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('openwa_user_profile');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const setRole = useCallback((newRole: UserRole | null) => {
    setRoleState(newRole);
    if (newRole) {
      localStorage.setItem('openwa_user_role', newRole);
    } else {
      localStorage.removeItem('openwa_user_role');
    }
  }, []);

  const setUser = useCallback((newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('openwa_user_profile', JSON.stringify(newUser));
      if (newUser.role) {
        setRoleState(newUser.role as UserRole);
        localStorage.setItem('openwa_user_role', newUser.role);
      }
    } else {
      localStorage.removeItem('openwa_user_profile');
    }
  }, []);

  const value: RoleContextType = {
    role,
    setRole,
    user,
    setUser,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isAgent: role === 'agent' || role === 'operator',
    isOperator: role === 'operator' || role === 'agent',
    isViewer: role === 'viewer',
    canWrite: role === 'admin' || role === 'manager' || role === 'operator' || role === 'agent',
    canManageUsers: role === 'admin' || role === 'manager',
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
