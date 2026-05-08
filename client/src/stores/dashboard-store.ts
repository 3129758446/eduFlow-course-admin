import { create } from 'zustand';
import { fetchDashboard } from '../api';
import type { DashboardData } from '../types';
import { appErrorMessage } from '../utils/text';
import { useAuthStore } from './auth-store';
import { registerStoreResetter } from './reset-registry';

type DashboardStore = {
  data: DashboardData | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

function clearGlobalError() {
  useAuthStore.getState().setGlobalError('');
}

function setGlobalError(error: unknown) {
  useAuthStore.getState().setGlobalError(appErrorMessage(error));
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  data: null,
  loading: true,
  refresh: async () => {
    set({ loading: true });

    try {
      const data = await fetchDashboard();
      set({ data, loading: false });
      clearGlobalError();
    } catch (error) {
      set({ loading: false });
      setGlobalError(error);
    }
  },
}));

registerStoreResetter(() => {
  useDashboardStore.setState({
    data: null,
    loading: true,
  });
});
