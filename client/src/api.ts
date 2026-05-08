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
