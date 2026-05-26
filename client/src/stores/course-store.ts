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
import { registerStoreResetter } from "./reset-registry";
import { clearGlobalError, setGlobalError } from "./store-error";

// 默认课程查询参数
const defaultCourseQuery: CourseQuery = {
  keyword: "",
  status: "",
  category: "",
  page: 1,
  pageSize: 10,
  sortField: "",
  sortOrder: "",
};

type CourseStore = {
  data: CourseListResponse | null; // 课程列表数据
  loading: boolean; // 列表数据加载状态
  categories: string[]; // 课程分类列表
  query: CourseQuery; // 课程查询参数
  draftKeyword: string; // 草稿关键词
  formOpen: boolean; // 表单弹窗是否打开
  editingId: number | null; // 当前编辑的课程 ID
  formLoading: boolean; // 表单提交加载状态
  setDraftKeyword: (value: string) => void; // 设置草稿关键词
  initializePage: () => Promise<void>; // 初始化页面数据
  refreshList: () => Promise<void>; // 刷新课程列表
  loadCategories: () => Promise<void>; // 加载课程分类列表
  updateQuery: (updater: (prev: CourseQuery) => CourseQuery) => Promise<void>; // 更新查询查询参数
  resetFilters: () => Promise<void>; // 重置筛选参数
  openCreate: () => void; // 打开创建课程表单
  openEdit: (id: number) => Promise<Course | null>; // 打开编辑课程表单
  closeForm: () => void; // 关闭表单弹窗
  submitForm: (payload: CourseFormValue) => Promise<void>; // 提交表单数据
  deleteCourseById: (id: number) => Promise<void>; // 删除课程
  toggleCourseStatusById: (id: number) => Promise<void>; // 切换课程状态
};

export const useCourseStore = create<CourseStore>((set, get) => ({
  data: null,
  loading: true,
  categories: [],
  query: defaultCourseQuery,
  draftKeyword: "", // 草稿关键词
  formOpen: false, // 表单弹窗是否打开
  editingId: null, // 当前编辑的课程 ID
  formLoading: false, // 表单提交加载状态
  // 设置草稿关键词
  setDraftKeyword: (value) => set({ draftKeyword: value }),
  // 初始化页面数据
  initializePage: async () => {
    // 列表数据和筛选辅助数据并行拉取，减少首屏等待时间。
    await Promise.all([get().refreshList(), get().loadCategories()]);
  },
  // 刷新课程列表
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
  // 加载课程分类列表
  loadCategories: async () => {
    try {
      const categories = await fetchCourseCategories();
      set({ categories });
    } catch (error) {
      setGlobalError(error);
    }
  },
  // 更新查询查询参数
  updateQuery: async (updater) => {
    // 所有列表交互都通过 query 收敛，保证筛选、排序、分页的数据源一致。
    set((state) => ({
      query: updater(state.query), // 更新查询参数
      loading: true,
    }));
    await get().refreshList();
  },
  // 重置筛选参数
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
  // 打开创建课程表单
  openCreate: () => {
    set({
      editingId: null,
      formOpen: true,
    });
  },
  // 打开编辑课程表单
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
  // 关闭表单弹窗
  closeForm: () => {
    set({ formOpen: false });
  },
  // 提交表单数据
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
  // 删除课程
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
  // 切换课程状态
  toggleCourseStatusById: async (id) => {
    try {
      await toggleCourseStatus(id);
      await get().refreshList();
    } catch (error) {
      setGlobalError(error);
    }
  },
}));
// 重置课程数据仓库
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
