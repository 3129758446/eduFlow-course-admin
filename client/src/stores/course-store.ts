/* 
模块：课程管理仓库（Zustand）
定位：统一管理课程列表/筛选/分页/排序、表单弹窗与增删改发布操作
数据流：fetchCourses(query) -> data；表单 openEdit(id)->fetchDetail；删除后根据总数校正页码
对外：data/loading/categories/query/formOpen/editingId/... 及操作函数
用法：CoursesPage 通过 shallow 选择器订阅最小集合，事件直接调用 store 方法
学习要点：
- 将草稿关键词 draftKeyword 与查询 keyword 分离，避免输入抖动频繁请求
- 危险操作用 Popconfirm 二次确认；状态切换后刷新列表保持口径一致
*/
import { create } from "zustand";
import {
  createCourse,
  deleteCourse,
  fetchCourseCategories,
  fetchCourseDetail,
  fetchCourses,
  toggleCourseStatus,
  updateCourse,
} from "../api";
import type {
  Course,
  CourseFormValue,
  CourseListResponse,
  CourseQuery,
} from "../types";
import { pageAfterDelete } from "../utils/pagination";
import { appErrorMessage } from "../utils/text";
import { registerStoreResetter } from "./reset-registry";
import { useAuthStore } from "./auth-store";

const defaultCourseQuery: CourseQuery = {
  keyword: "",
  status: "",
  category: "",
  page: 1,
  pageSize: 10,
  sortField: "",
  sortOrder: "",
};

function clearGlobalError() {
  useAuthStore.getState().setGlobalError("");
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
  draftKeyword: "",
  formOpen: false,
  editingId: null,
  formLoading: false,
  setDraftKeyword: (value) => set({ draftKeyword: value }),
  initializePage: async () => {
    // 列表数据和筛选辅助数据并行拉取，减少首屏等待时间。
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
    // 所有列表交互都通过 query 收敛，保证筛选、排序、分页的数据源一致。
    set((state) => ({
      query: updater(state.query),
      loading: true,
    }));
    await get().refreshList();
  },
  resetFilters: async () => {
    set((state) => ({
      draftKeyword: "",
      query: {
        ...state.query,
        keyword: "",
        status: "",
        category: "",
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
      // 以 editingId 是否存在区分新增/编辑，页面层无需关心调用哪个接口。
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
      // 删除最后一条数据时，可能出现“当前页被删空”的情况，这里自动回退到有效页码。
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
    draftKeyword: "",
    formOpen: false,
    editingId: null,
    formLoading: false,
  });
});
