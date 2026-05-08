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

export type SummaryData = {
  content: string;
};
