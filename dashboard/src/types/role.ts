// Role types for RBAC
import type { User } from '../services/api';

export type UserRole = 'admin' | 'manager' | 'operator' | 'agent' | 'viewer';

export interface RoleContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  isAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  isOperator: boolean;
  isViewer: boolean;
  canWrite: boolean;
  canManageUsers: boolean;
}
