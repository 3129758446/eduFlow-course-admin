import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/auth-store';

export function useRouterAuth() {
  return useAuthStore(
    useShallow((state) => ({
      authLoading: state.authLoading,
      initialized: state.initialized,
      token: state.token,
      user: state.user,
      globalError: state.globalError,
      setGlobalError: state.setGlobalError,
      handleLogin: state.handleLogin,
      handleLogout: state.handleLogout,
    }))
  );
}
