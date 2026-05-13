/*
模块：学习总结仓库（Zustand）
定位：管理当前用户自己的多篇学习总结，包括分页列表、详情查看、新增、编辑和删除
数据流：SummaryPage -> store action -> api.ts -> /api/summary，后端按当前登录用户隔离数据
*/
import { create } from 'zustand';
import {
  createSummary,
  deleteSummary,
  fetchSummaries,
  fetchSummaryDetail,
  updateSummary,
} from '../api';
import type {
  Summary,
  SummaryFormValue,
  SummaryListResponse,
  SummaryQuery,
} from '../types';
import { pageAfterDelete } from '../utils/pagination';
import { appErrorMessage } from '../utils/text';
import { useAuthStore } from './auth-store';
import { registerStoreResetter } from './reset-registry';

const defaultSummaryQuery: SummaryQuery = {
  keyword: '',
  page: 1,
  pageSize: 10,
};

type SummaryStore = {
  data: SummaryListResponse | null;
  detail: Summary | null;
  loading: boolean;
  detailLoading: boolean;
  formOpen: boolean;
  formLoading: boolean;
  editingId: number | null;
  viewingId: number | null;
  query: SummaryQuery;
  draftKeyword: string;
  setDraftKeyword: (value: string) => void;
  refreshList: () => Promise<void>;
  updateQuery: (updater: (prev: SummaryQuery) => SummaryQuery) => Promise<void>;
  resetFilters: () => Promise<void>;
  openCreate: () => void;
  openEdit: (id: number) => Promise<Summary | null>;
  openView: (id: number) => Promise<void>;
  closeForm: () => void;
  closeView: () => void;
  submitForm: (payload: SummaryFormValue) => Promise<void>;
  deleteById: (id: number) => Promise<void>;
};

function clearGlobalError() {
  useAuthStore.getState().setGlobalError('');
}

function setGlobalError(error: unknown) {
  useAuthStore.getState().setGlobalError(appErrorMessage(error));
}

export const useSummaryStore = create<SummaryStore>((set, get) => ({
  data: null,
  detail: null,
  loading: true,
  detailLoading: false,
  formOpen: false,
  formLoading: false,
  editingId: null,
  viewingId: null,
  query: defaultSummaryQuery,
  draftKeyword: '',
  setDraftKeyword: (value) => set({ draftKeyword: value }),
  refreshList: async () => {
    set({ loading: true });
    try {
      const data = await fetchSummaries(get().query);
      set({ data, loading: false });
      clearGlobalError();
    } catch (error) {
      set({ loading: false });
      setGlobalError(error);
    }
  },
  updateQuery: async (updater) => {
    set((state) => ({
      query: updater(state.query),
      loading: true,
    }));
    await get().refreshList();
  },
  resetFilters: async () => {
    set({
      draftKeyword: '',
      query: defaultSummaryQuery,
      loading: true,
    });
    await get().refreshList();
  },
  openCreate: () => {
    set({
      editingId: null,
      formOpen: true,
      detail: null,
    });
  },
  openEdit: async (id) => {
    set({
      editingId: id,
      formOpen: true,
      formLoading: true,
    });
    try {
      const detail = await fetchSummaryDetail(id);
      set({ detail, formLoading: false });
      clearGlobalError();
      return detail;
    } catch (error) {
      set({
        formOpen: false,
        formLoading: false,
        editingId: null,
      });
      setGlobalError(error);
      return null;
    }
  },
  openView: async (id) => {
    set({
      viewingId: id,
      detail: null,
      detailLoading: true,
    });
    try {
      const detail = await fetchSummaryDetail(id);
      set({ detail, detailLoading: false });
      clearGlobalError();
    } catch (error) {
      set({
        viewingId: null,
        detail: null,
        detailLoading: false,
      });
      setGlobalError(error);
    }
  },
  closeForm: () => {
    set({
      formOpen: false,
      formLoading: false,
      editingId: null,
    });
  },
  closeView: () => {
    set({
      viewingId: null,
      detail: null,
      detailLoading: false,
    });
  },
  submitForm: async (payload) => {
    set({ formLoading: true });
    try {
      const { editingId } = get();
      if (editingId) {
        await updateSummary(editingId, payload);
      } else {
        await createSummary(payload);
      }
      set({
        formOpen: false,
        formLoading: false,
        editingId: null,
      });
      await get().refreshList();
    } catch (error) {
      set({ formLoading: false });
      setGlobalError(error);
      throw error;
    }
  },
  deleteById: async (id) => {
    try {
      await deleteSummary(id);
      const { data, query } = get();
      const nextPage = pageAfterDelete({
        page: query.page,
        pageSize: query.pageSize,
        total: data?.total ?? 0,
      });

      if (nextPage !== query.page) {
        set({ query: { ...query, page: nextPage } });
      }

      await get().refreshList();
    } catch (error) {
      setGlobalError(error);
    }
  },
}));

registerStoreResetter(() => {
  useSummaryStore.setState({
    data: null,
    detail: null,
    loading: true,
    detailLoading: false,
    formOpen: false,
    formLoading: false,
    editingId: null,
    viewingId: null,
    query: defaultSummaryQuery,
    draftKeyword: '',
  });
});
