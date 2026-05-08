import { create } from 'zustand';
import {
  createStudent,
  deleteStudent,
  fetchClasses,
  fetchCourses,
  fetchStudentDetail,
  fetchStudents,
  updateStudent,
} from '../api';
import type {
  Course,
  StudentDetail,
  StudentFormValue,
  StudentListResponse,
  StudentQuery,
} from '../types';
import { pageAfterDelete } from '../utils/pagination';
import { appErrorMessage } from '../utils/text';
import { registerStoreResetter } from './reset-registry';
import { useAuthStore } from './auth-store';

const defaultStudentQuery: StudentQuery = {
  keyword: '',
  className: '',
  status: '',
  page: 1,
  pageSize: 10,
};

function clearGlobalError() {
  useAuthStore.getState().setGlobalError('');
}

function setGlobalError(error: unknown) {
  useAuthStore.getState().setGlobalError(appErrorMessage(error));
}

type StudentStore = {
  data: StudentListResponse | null;
  loading: boolean;
  classes: string[];
  courses: Course[];
  query: StudentQuery;
  draftKeyword: string;
  formOpen: boolean;
  editingId: number | null;
  formLoading: boolean;
  deletingId: number | null;
  setDraftKeyword: (value: string) => void;
  initializePage: () => Promise<void>;
  refreshList: () => Promise<void>;
  loadSupportData: () => Promise<void>;
  updateQuery: (updater: (prev: StudentQuery) => StudentQuery) => Promise<void>;
  resetFilters: () => Promise<void>;
  openCreate: () => void;
  openEdit: (id: number) => Promise<StudentDetail | null>;
  closeForm: () => void;
  submitForm: (payload: StudentFormValue) => Promise<void>;
  deleteStudentById: (id: number) => Promise<void>;
};

export const useStudentStore = create<StudentStore>((set, get) => ({
  data: null,
  loading: true,
  classes: [],
  courses: [],
  query: defaultStudentQuery,
  draftKeyword: '',
  formOpen: false,
  editingId: null,
  formLoading: false,
  deletingId: null,
  setDraftKeyword: (value) => set({ draftKeyword: value }),
  initializePage: async () => {
    await Promise.all([get().refreshList(), get().loadSupportData()]);
  },
  refreshList: async () => {
    set({ loading: true });
    try {
      const result = await fetchStudents(get().query);
      set({ data: result, loading: false });
      clearGlobalError();
    } catch (error) {
      set({ loading: false });
      setGlobalError(error);
    }
  },
  loadSupportData: async () => {
    try {
      const [classes, courses] = await Promise.all([
        fetchClasses(),
        fetchCourses({
          page: 1,
          pageSize: 100,
          keyword: '',
          status: '',
          category: '',
          sortField: '',
          sortOrder: '',
        }).then((result) => result.list),
      ]);

      set({
        classes,
        courses,
      });
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
        className: '',
        status: '',
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
      const detail = await fetchStudentDetail(id);
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
        await updateStudent(editingId, payload);
      } else {
        await createStudent(payload);
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
  deleteStudentById: async (id) => {
    set({ deletingId: id });

    try {
      await deleteStudent(id);

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
    } finally {
      set({ deletingId: null });
    }
  },
}));

registerStoreResetter(() => {
  useStudentStore.setState({
    data: null,
    loading: true,
    classes: [],
    courses: [],
    query: defaultStudentQuery,
    draftKeyword: '',
    formOpen: false,
    editingId: null,
    formLoading: false,
    deletingId: null,
  });
});
