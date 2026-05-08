import { clearAuth, getAuthToken } from './auth';
import type {
  ApiEnvelope,
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

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = getAuthToken();

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (response.status === 401 || payload.code === 401) {
    clearAuth();
    throw new Error('登录已失效，请重新登录');
  }

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || '请求失败');
  }

  return payload.data;
}

export function login(params: { username: string; password: string }) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getCurrentUser() {
  return request<User>('/auth/me');
}

export function fetchDashboard() {
  return request<DashboardData>('/dashboard');
}

export function fetchCourses(query: Partial<CourseQuery>) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  });
  return request<CourseListResponse>(`/courses?${search.toString()}`);
}

export function fetchCourseCategories() {
  return request<string[]>('/courses/categories');
}

export function fetchCourseDetail(id: number) {
  return request<Course>(`/courses/${id}`);
}

export function createCourse(payload: CourseFormValue) {
  return request<Course>('/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCourse(id: number, payload: CourseFormValue) {
  return request<Course>(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteCourse(id: number) {
  return request<null>(`/courses/${id}`, {
    method: 'DELETE',
  });
}

export function toggleCourseStatus(id: number) {
  return request<Course>(`/courses/${id}/status`, {
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
  return request<StudentListResponse>(`/students?${search.toString()}`);
}

export function fetchClasses() {
  return request<string[]>('/students/classes');
}

export function fetchStudentDetail(id: number) {
  return request<StudentDetail>(`/students/${id}`);
}

export function createStudent(payload: StudentFormValue) {
  return request<StudentDetail>('/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStudent(id: number, payload: StudentFormValue) {
  return request<StudentDetail>(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteStudent(id: number) {
  return request<null>(`/students/${id}`, {
    method: 'DELETE',
  });
}

export function fetchSummary() {
  return request<SummaryData>('/summary');
}
