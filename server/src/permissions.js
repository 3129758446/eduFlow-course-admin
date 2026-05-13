/*
模块：固定权限字典
定位：集中维护系统权限码、固定角色和固定角色权限
说明：本项目已移除角色权限动态配置，运行时直接按 role 返回固定权限。
*/
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  COURSES_VIEW: 'courses:view',
  COURSES_CREATE: 'courses:create',
  COURSES_UPDATE: 'courses:update',
  COURSES_DELETE: 'courses:delete',
  STUDENTS_VIEW: 'students:view',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_DELETE: 'students:delete',
  SUMMARY_VIEW: 'summary:view',
  SUMMARY_CREATE: 'summary:create',
  SUMMARY_UPDATE: 'summary:update',
  SUMMARY_DELETE: 'summary:delete',
  ACCOUNTS_VIEW: 'accounts:view',
  ACCOUNTS_UPDATE_ROLE: 'accounts:updateRole',
};

export const DEFAULT_ROLES = [
  { code: 'admin', name: '管理员', description: '拥有全部权限' },
  { code: 'teacher', name: '教师', description: '可维护课程、学生和自己的学习总结，不可删除课程/学生' },
  { code: 'student', name: '学生', description: '可查看基础数据并维护自己的学习总结' },
];

export const MANAGED_ROLES = ['teacher', 'student'];

// 固定权限策略：admin 自动拿到全部权限；teacher/student 只维护这里的白名单。
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS),
  teacher: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.COURSES_CREATE,
    PERMISSIONS.COURSES_UPDATE,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.SUMMARY_VIEW,
    PERMISSIONS.SUMMARY_CREATE,
    PERMISSIONS.SUMMARY_UPDATE,
    PERMISSIONS.SUMMARY_DELETE,
  ],
  student: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.SUMMARY_VIEW,
    PERMISSIONS.SUMMARY_CREATE,
    PERMISSIONS.SUMMARY_UPDATE,
    PERMISSIONS.SUMMARY_DELETE,
  ],
};

export function getPermissionsByRole(role) {
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}
