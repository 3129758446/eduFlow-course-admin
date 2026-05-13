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
import { registerStoreResetter } from "./reset-registry";
import { clearGlobalError, setGlobalError } from "./store-error";

const defaultStudentQuery: StudentQuery = {
  keyword: "",
  className: "",
  status: "",
  page: 1,
  pageSize: 10,
};

type StudentStore = {
  data: StudentListResponse | null; // 学生列表数据
  loading: boolean; // 加载状态
  classes: string[]; // 班级列表
  courses: Course[]; // 课程列表
  query: StudentQuery; // 筛选参数
  draftKeyword: string; // 草稿关键词
  formOpen: boolean; // 表单弹窗状态
  editingId: number | null; // 编辑中的学生ID
  formLoading: boolean; // 表单提交状态
  deletingId: number | null; // 删除中的学生ID
  setDraftKeyword: (value: string) => void; // 设置草稿关键词
  initializePage: () => Promise<void>; // 初始化页面数据
  refreshList: () => Promise<void>; // 刷新学生列表
  loadSupportData: () => Promise<void>; // 加载班级/课程支持数据
  updateQuery: (updater: (prev: StudentQuery) => StudentQuery) => Promise<void>; // 更新筛选参数
  resetFilters: () => Promise<void>; // 重置筛选参数
  openCreate: () => void; // 打开创建表单
  openEdit: (id: number) => Promise<StudentDetail | null>; // 打开编辑表单
  closeForm: () => void; // 关闭表单弹窗
  submitForm: (payload: StudentFormValue) => Promise<void>; // 提交表单数据
  deleteStudentById: (id: number) => Promise<void>; // 删除学生
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
  // 刷新学生列表
  refreshList: async () => {
    set({ loading: true });
    try {
      const result = await fetchStudents(get().query);
      set({ data: result, loading: false });
      clearGlobalError(); // 刷新列表成功时，清除错误信息
    } catch (error) { 
      // 刷新列表失败时，显示错误信息并重置加载状态
      set({ loading: false });
      setGlobalError(error);
    }
  },
  // 加载班级/课程支持数据
  loadSupportData: async () => {
    try {
      // 课程选择与班级筛选都依赖支持数据，这里集中加载避免页面自己维护多份状态。
      const [classes, courses] = await Promise.all([
        fetchClasses(),
        fetchCourses({
          page: 1,
          pageSize: 100,
          keyword: "", // 空关键词确保加载所有课程
          status: "", // 空状态确保加载所有课程
          category: "", // 空分类确保加载所有课程
          sortField: "", // 空排序字段确保加载所有课程
          sortOrder: "", // 空排序顺序确保加载所有课程
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
  // 更新筛选参数
  updateQuery: async (updater) => {
    // 统一通过 query 驱动列表请求，便于复用分页、搜索和筛选逻辑。
    set((state) => ({
      query: updater(state.query),
      loading: true,
    }));
    await get().refreshList();
  },
  // 删除学生重置筛选参数
  resetFilters: async () => {
    set((state) => ({
      draftKeyword: "",
      query: {
        ...state.query, // 重置筛选参数
        keyword: "",
        className: "",
        status: "",
        page: 1,
      },
      loading: true,
    }));
    await get().refreshList();
  },
  // 打开创建表单
  openCreate: () => {
    set({
      editingId: null,
      formOpen: true,
    });
  },
  // 打开编辑表单
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
  // 关闭表单弹窗
  closeForm: () => {
    set({ formOpen: false });
  },
  // 提交表单数据
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
  // 删除学生
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

// 重置学生状态
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
