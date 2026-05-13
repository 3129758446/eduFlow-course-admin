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
import { registerStoreResetter } from './reset-registry';
import { clearGlobalError, setGlobalError } from './store-error';

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
      // 列表只拉摘要字段，详情内容在查看/编辑时再按 id 拉取，避免列表响应过大。
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
    // 新增和编辑共用一个弹窗，editingId 为 null 时表示创建模式。
    set({
      editingId: null,
      formOpen: true,
      detail: null,
    });
  },
  openEdit: async (id) => {
    // 编辑前先拉详情，保证表单里是服务端最新内容，而不是列表里的旧标题。
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
    // 查看详情与编辑详情共用 detail 字段，但用 viewingId/formOpen 区分弹窗类型。
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
      // submitForm 统一处理新增/编辑，页面层不需要知道应该调用哪个接口。
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
      // 删除当前页最后一条时，自动回退到仍有数据的页码，避免出现空白页。
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
