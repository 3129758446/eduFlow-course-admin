/* 
模块：学生管理仓库（Zustand）
定位：统一管理学生列表/筛选/分页、表单弹窗与增删改操作，并维护支持数据（班级/课程）
数据流：fetchStudents(query)->data；openEdit(id)->fetchStudentDetail；删除后页码回退
对外：data/loading/classes/courses/query/... 及操作函数
用法：StudentsPage 订阅并驱动；学号唯一性校验在页面层使用 API 方法
学习要点：
- 支持数据通过 Promise.all 并行加载；删除时显示 deletingId 控制按钮 loading
*/
import { create } from "zustand";
import {
  createStudent,
  deleteStudent,
  fetchClasses,
  fetchCourses,
  fetchStudentDetail,
  fetchStudents,
  updateStudent,
} from "../api";
import type {
  Course,
  StudentDetail,
  StudentFormValue,
  StudentListResponse,
  StudentQuery,
} from "../types";
import { pageAfterDelete } from "../utils/pagination";
import { appErrorMessage } from "../utils/text";
import { registerStoreResetter } from "./reset-registry";
import { useAuthStore } from "./auth-store";

const defaultStudentQuery: StudentQuery = {
  keyword: "",
  className: "",
  status: "",
  page: 1,
  pageSize: 10,
};

function clearGlobalError() {
  useAuthStore.getState().setGlobalError("");
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
  draftKeyword: "",
  formOpen: false,
  editingId: null,
  formLoading: false,
  deletingId: null,
  setDraftKeyword: (value) => set({ draftKeyword: value }),
  initializePage: async () => {
    // 学生列表和班级/课程辅助数据并行加载，打开页面即可完成筛选与表单准备。
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
      // 课程选择与班级筛选都依赖支持数据，这里集中加载避免页面自己维护多份状态。
      const [classes, courses] = await Promise.all([
        fetchClasses(),
        fetchCourses({
          page: 1,
          pageSize: 100,
          keyword: "",
          status: "",
          category: "",
          sortField: "",
          sortOrder: "",
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
    // 统一通过 query 驱动列表请求，便于复用分页、搜索和筛选逻辑。
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
        className: "",
        status: "",
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
      // 与课程模块保持一致：editingId 存在表示编辑，否则为新增。
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
    // 记录当前删除行，用于给对应按钮显示 loading，而不是整页阻塞。
    set({ deletingId: id });

    try {
      await deleteStudent(id);

      const { data, query } = get();
      // 删除后自动回退到仍然存在数据的页码，避免出现空白页。
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
    draftKeyword: "",
    formOpen: false,
    editingId: null,
    formLoading: false,
    deletingId: null,
  });
});
