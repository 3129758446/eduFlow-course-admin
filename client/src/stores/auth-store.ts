import { create } from "zustand";
import { getCurrentUser, login } from "../api";
import { clearAuth, getAuthToken, setAuth } from "../auth";
import type { User } from "../types";
import { resetAllStores } from "./reset-registry";

type AuthStore = {
  authLoading: boolean;
  initialized: boolean;
  token: string | null;
  user: User | null;
  globalError: string;
  setGlobalError: (value: string) => void;
  initializeAuth: () => Promise<void>;
  handleLogin: (username: string, password: string) => Promise<void>;
  handleLogout: () => void;
};

const initialToken = getAuthToken();
let initializePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>((set) => ({
  authLoading: Boolean(initialToken),
  initialized: false,
  token: initialToken,
  user: null,
  globalError: "",
  setGlobalError: (value) => set({ globalError: value }),
  initializeAuth: async () => {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      const token = getAuthToken();

      if (!token) {
        set({
          authLoading: false,
          initialized: true,
          token: null,
          user: null,
        });
        return;
      }

      set({ authLoading: true, token });

      try {
        const user = await getCurrentUser();
        set({
          authLoading: false,
          initialized: true,
          token,
          user,
        });
      } catch {
        clearAuth();
        resetAllStores();
        set({
          authLoading: false,
          initialized: true,
          token: null,
          user: null,
        });
      } finally {
        initializePromise = null;
      }
    })();

    return initializePromise;
  },
  handleLogin: async (username, password) => {
    const data = await login({ username, password });
    setAuth(data.token, data.user);
    set({
      authLoading: false,
      initialized: true,
      token: data.token,
      user: data.user,
      globalError: "",
    });
  },
  handleLogout: () => {
    clearAuth();
    resetAllStores();
    set({
      authLoading: false,
      initialized: true,
      token: null,
      user: null,
      globalError: "",
    });
  },
}));
