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
  StudentDetail,
  StudentFormValue,
  StudentListResponse,
  StudentQuery,
  SummaryData,
  User,
} from './types';
import { request } from './utils/request';

export function login(params: { username: string; password: string }) {
  return request<LoginResponse>({
    url: '/auth/login',
    method: 'POST',
    data: params,
  });
}

export function getCurrentUser() {
  return request<User>({ url: '/auth/me' });
}

export function fetchDashboard() {
  return request<DashboardData>({ url: '/dashboard' });
}

export function fetchCourses(query: Partial<CourseQuery>) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  });
  return request<CourseListResponse>({ url: `/courses?${search.toString()}` });
}

export function fetchCourseCategories() {
  return request<string[]>({ url: '/courses/categories' });
}

export function fetchCourseDetail(id: number) {
  return request<Course>({ url: `/courses/${id}` });
}

export function createCourse(payload: CourseFormValue) {
  return request<Course>({
    url: '/courses',
    method: 'POST',
    data: payload,
  });
}

export function updateCourse(id: number, payload: CourseFormValue) {
  return request<Course>({
    url: `/courses/${id}`,
    method: 'PUT',
    data: payload,
  });
}

export function deleteCourse(id: number) {
  return request<null>({
    url: `/courses/${id}`,
    method: 'DELETE',
  });
}

export function toggleCourseStatus(id: number) {
  return request<Course>({
    url: `/courses/${id}/status`,
    method: 'PATCH',
  });
}

export function fetchStudents(query: Partial<StudentQuery>) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  });
  return request<StudentListResponse>({ url: `/students?${search.toString()}` });
}

export function fetchClasses() {
  return request<string[]>({ url: '/students/classes' });
}

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

export function fetchStudentDetail(id: number) {
  return request<StudentDetail>({ url: `/students/${id}` });
}

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

export function fetchSummary() {
  return request<SummaryData>({ url: '/summary' });
}
