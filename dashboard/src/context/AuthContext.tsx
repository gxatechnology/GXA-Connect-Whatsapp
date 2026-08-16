import React, { createContext, useContext, useMemo } from 'react';
import { useRole } from '../hooks/useRole';
import type { User } from '../services/api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  role: string | null;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  role: null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useRole();
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('openwa_api_key') : null;

  const value = useMemo(
    () => ({
      token,
      user,
      role,
    }),
    [token, user, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
