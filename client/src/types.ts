/* 
模块：类型定义
定位：统一声明接口返回/实体/查询与表单类型，服务端/前端口径一致
要点：ApiEnvelope<T> 作为后端统一返回壳；Course/Student/Summary 等业务类型集中管理
*/
import type { PermissionCode } from './permissions';

export type ApiEnvelope<T> = {
  code: number;
  msg: string;
  data: T;
};

export type User = {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: PermissionCode[];
  avatar: string;
  created_at: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type DashboardData = {
  stats: {
    totalCourses: number;
    publishedCourses: number;
    totalStudents: number;
    activeStudents: number;
  };
  charts: {
    enrollment: Array<{ name: string; value: number }>;
    activity: Array<{ date: string; label: string; students: number; duration: number }>;
    statusDist: Array<{ name: string; value: number }>;
    categoryDist: Array<{ name: string; value: number }>;
  };
};

export type Course = {
  id: number;
  name: string;
  description: string;
  instructor: string;
  cover: string;
  category: string;
  status: string;
  student_count: number;
  lesson_count: number;
  created_at: string;
  updated_at: string;
};

export type CourseListResponse = {
  list: Course[];
  total: number;
  page: number;
  pageSize: number;
};

// 课程查询参数
export type CourseQuery = {
  keyword: string;
  status: string;
  category: string;
  page: number;
  pageSize: number;
  sortField: string;
  sortOrder: string;
};

export type CourseFormValue = {
  name: string;
  description: string;
  instructor: string;
  category: string;
  status: string;
  lesson_count: number;
};

export type Student = {
  id: number;
  name: string;
  student_no: string;
  class_name: string;
  phone: string;
  email: string;
  status: string;
  course_ids: number[];
  created_at: string;
  updated_at: string;
};

export type StudentDetail = Student & {
  enrolledCourses: Array<{ id: number; name: string }>;
};

export type StudentListResponse = {
  list: Student[];
  total: number;
  page: number;
  pageSize: number;
};

// 学生查询参数
export type StudentQuery = {
  keyword: string;
  className: string;
  status: string;
  page: number;
  pageSize: number;
};

export type StudentFormValue = {
  name: string;
  student_no: string;
  class_name: string;
  phone: string;
  email: string;
  status: string;
  course_ids: number[];
};

export type Summary = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type SummaryListItem = Omit<Summary, 'content'>;

export type SummaryListResponse = {
  list: SummaryListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type SummaryQuery = {
  keyword: string;
  page: number;
  pageSize: number;
};

export type SummaryFormValue = {
  title: string;
  content: string;
};

export type AccountUser = Pick<
  User,
  'id' | 'username' | 'name' | 'role' | 'avatar' | 'created_at'
>;

export type Role = {
  id: number;
  code: string;
  name: string;
  description: string;
  created_at: string;
  permissions: string[];
};

export type SystemPermission = {
  id: number;
  code: string;
  name: string;
  module: string;
  module_name: string;
  sort_order: number;
};

export type RolePermissionData = {
  roles: Role[];
  permissions: SystemPermission[];
};
