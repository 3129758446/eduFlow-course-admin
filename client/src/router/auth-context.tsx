import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUser, login } from '../api';
import { clearAuth, getAuthToken, setAuth } from '../auth';
import type { User } from '../types';
import { AuthContext, type AuthContextValue } from './auth-shared';

export function RouterAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<User | null>(null);
  const [globalError, setGlobalError] = useState('');
  const [authLoading, setAuthLoading] = useState(Boolean(getAuthToken()));

  useEffect(() => {
    if (!token || user) {
      return;
    }

    let active = true;

    getCurrentUser()
      .then((data) => {
        if (!active) return;
        setUser(data);
      })
      .catch(() => {
        if (!active) return;
        clearAuth();
        setToken(null);
        setUser(null);
        setAuthLoading(false);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authLoading,
      token,
      user,
      globalError,
      setGlobalError,
      handleLogin: async (username: string, password: string) => {
        const data = await login({ username, password });
        setAuth(data.token, data.user);
        setToken(data.token);
        setUser(data.user);
        setGlobalError('');
        setAuthLoading(false);
      },
      handleLogout: () => {
        clearAuth();
        setToken(null);
        setUser(null);
        setGlobalError('');
        setAuthLoading(false);
      },
    }),
    [authLoading, globalError, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
