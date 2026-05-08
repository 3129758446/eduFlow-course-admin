import { createContext } from 'react';
import type { User } from '../types';

export type AuthContextValue = {
  authLoading: boolean;
  token: string | null;
  user: User | null;
  globalError: string;
  setGlobalError: (value: string) => void;
  handleLogin: (username: string, password: string) => Promise<void>;
  handleLogout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
