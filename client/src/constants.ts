/* 
模块：常量与默认表单值
定位：课程/学生状态枚举与表单初始值
用法：页面/Store 直接引用，避免魔法字符串散落
*/
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
