import { create } from 'zustand';
import {
  createCourse,
  deleteCourse,
  fetchCourseCategories,
  fetchCourseDetail,
  fetchCourses,
  toggleCourseStatus,
  updateCourse,
} from '../api';
import type {
  Course,
  CourseFormValue,
  CourseListResponse,
  CourseQuery,
} from '../types';
import { pageAfterDelete } from '../utils/pagination';
import { appErrorMessage } from '../utils/text';
import { registerStoreResetter } from './reset-registry';
import { useAuthStore } from './auth-store';

const defaultCourseQuery: CourseQuery = {
  keyword: '',
  status: '',
  category: '',
  page: 1,
  pageSize: 10,
  sortField: '',
  sortOrder: '',
};

function clearGlobalError() {
  useAuthStore.getState().setGlobalError('');
}

function setGlobalError(error: unknown) {
  useAuthStore.getState().setGlobalError(appErrorMessage(error));
}

type CourseStore = {
  data: CourseListResponse | null;
  loading: boolean;
  categories: string[];
  query: CourseQuery;
  draftKeyword: string;
  formOpen: boolean;
  editingId: number | null;
  formLoading: boolean;
  setDraftKeyword: (value: string) => void;
  initializePage: () => Promise<void>;
  refreshList: () => Promise<void>;
  loadCategories: () => Promise<void>;
  updateQuery: (updater: (prev: CourseQuery) => CourseQuery) => Promise<void>;
  resetFilters: () => Promise<void>;
  openCreate: () => void;
  openEdit: (id: number) => Promise<Course | null>;
  closeForm: () => void;
  submitForm: (payload: CourseFormValue) => Promise<void>;
  deleteCourseById: (id: number) => Promise<void>;
  toggleCourseStatusById: (id: number) => Promise<void>;
};

export const useCourseStore = create<CourseStore>((set, get) => ({
  data: null,
  loading: true,
  categories: [],
  query: defaultCourseQuery,
  draftKeyword: '',
  formOpen: false,
  editingId: null,
  formLoading: false,
  setDraftKeyword: (value) => set({ draftKeyword: value }),
  initializePage: async () => {
    await Promise.all([get().refreshList(), get().loadCategories()]);
  },
  refreshList: async () => {
    set({ loading: true });
    try {
      const result = await fetchCourses(get().query);
      set({ data: result, loading: false });
      clearGlobalError();
    } catch (error) {
      set({ loading: false });
      setGlobalError(error);
    }
  },
  loadCategories: async () => {
    try {
      const categories = await fetchCourseCategories();
      set({ categories });
    } catch (error) {
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
    set((state) => ({
      draftKeyword: '',
      query: {
        ...state.query,
        keyword: '',
        status: '',
        category: '',
        page: 1,
      },
      loading: true,
    }));
    await get().refreshList();
  },
  openCreate: () => {
    set({
      editingId: null,
      formOpen: true,
    });
  },
  openEdit: async (id) => {
    set({
      formLoading: true,
      formOpen: true,
    });

    try {
      const detail = await fetchCourseDetail(id);
      set({
        editingId: id,
        formLoading: false,
      });
      clearGlobalError();
      return detail;
    } catch (error) {
      set({
        formLoading: false,
        formOpen: false,
      });
      setGlobalError(error);
      return null;
    }
  },
  closeForm: () => {
    set({ formOpen: false });
  },
  submitForm: async (payload) => {
    set({ formLoading: true });

    try {
      const { editingId } = get();
      if (editingId) {
        await updateCourse(editingId, payload);
      } else {
        await createCourse(payload);
      }

      set({
        formOpen: false,
        formLoading: false,
      });
      await get().refreshList();
    } catch (error) {
      set({ formLoading: false });
      setGlobalError(error);
      throw error;
    }
  },
  deleteCourseById: async (id) => {
    try {
      await deleteCourse(id);

      const { data, query } = get();
      const nextPage = pageAfterDelete({
        page: query.page,
        pageSize: query.pageSize,
        total: data?.total ?? 0,
      });

      if (nextPage !== query.page) {
        set({
          query: { ...query, page: nextPage },
          loading: true,
        });
      }

      await get().refreshList();
    } catch (error) {
      setGlobalError(error);
    }
  },
  toggleCourseStatusById: async (id) => {
    try {
      await toggleCourseStatus(id);
      await get().refreshList();
    } catch (error) {
      setGlobalError(error);
    }
  },
}));

registerStoreResetter(() => {
  useCourseStore.setState({
    data: null,
    loading: true,
    categories: [],
    query: defaultCourseQuery,
    draftKeyword: '',
    formOpen: false,
    editingId: null,
    formLoading: false,
  });
});
