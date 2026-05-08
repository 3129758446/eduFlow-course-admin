import type { CourseFormValue, StudentFormValue } from './types';

export const COURSE_STATUS_TEXT: Record<string, string> = {
  published: '已发布',
  draft: '草稿',
};

export const STUDENT_STATUS_TEXT: Record<string, string> = {
  active: '活跃',
  inactive: '非活跃',
};

export const DEFAULT_COURSE_FORM: CourseFormValue = {
  name: '',
  description: '',
  instructor: '',
  category: '',
  status: 'draft',
  lesson_count: 0,
};

export const DEFAULT_STUDENT_FORM: StudentFormValue = {
  name: '',
  student_no: '',
  class_name: '',
  phone: '',
  email: '',
  status: 'active',
  course_ids: [],
};
