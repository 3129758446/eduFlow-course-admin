import { useContext } from 'react';
import { AuthContext } from './auth-shared';

export function useRouterAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useRouterAuth must be used within RouterAuthProvider');
  }
  return context;
}
