import { create } from 'zustand';
import { fetchSummary } from '../api';
import type { SummaryData } from '../types';
import { appErrorMessage } from '../utils/text';
import { useAuthStore } from './auth-store';
import { registerStoreResetter } from './reset-registry';

type SummaryStore = {
  data: SummaryData | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

function clearGlobalError() {
  useAuthStore.getState().setGlobalError('');
}

function setGlobalError(error: unknown) {
  useAuthStore.getState().setGlobalError(appErrorMessage(error));
}

export const useSummaryStore = create<SummaryStore>((set) => ({
  data: null,
  loading: true,
  refresh: async () => {
    set({ loading: true });

    try {
      const data = await fetchSummary();
      set({ data, loading: false });
      clearGlobalError();
    } catch (error) {
      set({ loading: false });
      setGlobalError(error);
    }
  },
}));

registerStoreResetter(() => {
  useSummaryStore.setState({
    data: null,
    loading: true,
  });
});
