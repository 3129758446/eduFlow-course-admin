/* 
模块：前端 API 封装
定位：集中声明与服务端交互的方法，统一查询参数构造与返回类型
数据流：request<T>() -> Axios 实例（带 token 拦截） -> Koa 接口 -> 统一 ApiEnvelope 解包 data
对外：登录、用户信息、工作台、课程（列表/详情/增改删/状态）、学生（列表/详情/增改删/校验）、总结
用法：
- 页面/Store 仅调用此处导出的函数，不直接拼接 URL；列表查询通过 Partial<Query> 传参
- 复杂查询参数使用 URLSearchParams 确保空值不入参
学习要点：
- 将服务端统一响应格式在 request 中落一层校验，业务处只拿 data
*/
import type {
  Course,
  CourseFormValue,
  CourseListResponse,
  CourseQuery,
  DashboardData,
  LoginResponse,
  AccountUser,
  Role,
  StudentDetail,
  StudentFormValue,
  StudentListResponse,
  StudentQuery,
  Summary,
  SummaryFormValue,
  SummaryListResponse,
  SummaryQuery,
  User,
} from './types';
import { request } from './utils/request';

// 登录
export function login(params: { username: string; password: string }) {
  return request<LoginResponse>({
    url: '/auth/login',
    method: 'POST',
    data: params,
  });
}

// 获取当前用户信息
export function getCurrentUser() {
  return request<User>({ url: '/auth/me' });
}

export function changePassword(payload: {
  oldPassword: string;
  newPassword: string;
}) {
  return request<null>({
    url: '/auth/password',
    method: 'PATCH',
    data: payload,
  });
}

// 获取工作台数据
export function fetchDashboard() {
  return request<DashboardData>({ url: '/dashboard' });
}

// 获取课程列表
export function fetchCourses(query: Partial<CourseQuery>) {
  const search = new URLSearchParams(); // 构建查询参数
  // 过滤空值
  Object.entries(query).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, String(value)); 
    }
  });
  return request<CourseListResponse>({ url: `/courses?${search.toString()}` });
}

// 获取课程分类
export function fetchCourseCategories() {
  return request<string[]>({ url: '/courses/categories' });
}

// 获取课程详情
export function fetchCourseDetail(id: number) {
  return request<Course>({ url: `/courses/${id}` });
}

// 创建课程
export function createCourse(payload: CourseFormValue) {
  return request<Course>({
    url: '/courses',
    method: 'POST',
    data: payload,
  });
}

// 更新课程
export function updateCourse(id: number, payload: CourseFormValue) {
  return request<Course>({
    url: `/courses/${id}`,
    method: 'PUT',
    data: payload,
  });
}

// 删除课程
export function deleteCourse(id: number) {
  return request<null>({
    url: `/courses/${id}`,
    method: 'DELETE',
  });
}

// 切换课程状态
export function toggleCourseStatus(id: number) {
  return request<Course>({
    url: `/courses/${id}/status`,
    method: 'PATCH', // PATCH 请求，更新状态字段
  });
}

// 获取学生列表
export function fetchStudents(query: Partial<StudentQuery>) {
  const search = new URLSearchParams(); // 构建查询参数
  // 过滤空值
  Object.entries(query).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, String(value)); 
    }
  });
  return request<StudentListResponse>({ url: `/students?${search.toString()}` });
}

// 获取班级列表
export function fetchClasses() {
  return request<string[]>({ url: '/students/classes' });
}

// 校验学生学号是否唯一
export function checkStudentNoUnique(studentNo: string, excludeId?: number) {
  return fetchStudents({
    keyword: studentNo,
    className: '',
    status: '',
    page: 1,
    pageSize: 1000,
  }).then((result) => {
    const duplicated = result.list.some(
      (student) => student.student_no === studentNo && student.id !== excludeId,
    );
    return { unique: !duplicated };
  });
}

// 获取学生详情
export function fetchStudentDetail(id: number) {
  return request<StudentDetail>({ url: `/students/${id}` });
}

// 创建学生
export function createStudent(payload: StudentFormValue) {
  return request<StudentDetail>({
    url: '/students',
    method: 'POST',
    data: payload,
  });
}

export function updateStudent(id: number, payload: StudentFormValue) {
  return request<StudentDetail>({
    url: `/students/${id}`,
    method: 'PUT',
    data: payload,
  });
}

export function deleteStudent(id: number) {
  return request<null>({
    url: `/students/${id}`,
    method: 'DELETE',
  });
}

export function fetchSummaries(query: Partial<SummaryQuery>) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  });
  return request<SummaryListResponse>({ url: `/summary?${search.toString()}` });
}

export function fetchSummaryDetail(id: number) {
  return request<Summary>({ url: `/summary/${id}` });
}

export function createSummary(payload: SummaryFormValue) {
  return request<Summary>({
    url: '/summary',
    method: 'POST',
    data: payload,
  });
}

export function updateSummary(id: number, payload: SummaryFormValue) {
  return request<Summary>({
    url: `/summary/${id}`,
    method: 'PUT',
    data: payload,
  });
}

export function deleteSummary(id: number) {
  return request<null>({
    url: `/summary/${id}`,
    method: 'DELETE',
  });
}

export function fetchAccounts() {
  return request<AccountUser[]>({ url: '/system/users' });
}

export function fetchRoles() {
  return request<Role[]>({ url: '/system/roles' });
}

export function updateAccountRole(id: number, role: string) {
  return request<AccountUser>({
    url: `/system/users/${id}/role`,
    method: 'PATCH',
    data: { role },
  });
}

export function createAccount(payload: {
  username: string;
  name: string;
  role: string;
}) {
  return request<AccountUser>({
    url: '/system/users',
    method: 'POST',
    data: payload,
  });
}

export function deleteAccount(id: number) {
  return request<null>({
    url: `/system/users/${id}`,
    method: 'DELETE',
  });
}
