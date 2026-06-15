/*
模块：固定权限字典
定位：集中维护系统权限码、固定角色和固定角色权限
说明：本项目已移除角色权限动态配置，运行时直接按 role 返回固定权限。
同步：前端 client/src/permissions.ts 保持同名镜像，用于菜单、路由和按钮控制。
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

// 角色列表
export const DEFAULT_ROLES = [
  { code: 'admin', name: '管理员', description: '拥有全部权限' },
  { code: 'teacher', name: '教师', description: '可维护课程、学生和自己的学习总结，不可删除课程/学生' },
  { code: 'student', name: '学生', description: '可查看基础数据并维护自己的学习总结' },
];

export const MANAGED_ROLES = ['teacher', 'student', 'custom'];

export const IMMUTABLE_ROLES = ['admin'];
export const EDITABLE_ROLES = ['teacher', 'student', 'custom'];

// 固定权限策略：admin 自动拿到全部权限；teacher/student 只维护这里的白名单。
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS), // 管理员权限
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

export const PERMISSION_DEPENDENCIES = {
  [PERMISSIONS.COURSES_CREATE]: [PERMISSIONS.COURSES_VIEW],
  [PERMISSIONS.COURSES_UPDATE]: [PERMISSIONS.COURSES_VIEW],
  [PERMISSIONS.COURSES_DELETE]: [PERMISSIONS.COURSES_VIEW],
  [PERMISSIONS.STUDENTS_CREATE]: [PERMISSIONS.STUDENTS_VIEW],
  [PERMISSIONS.STUDENTS_UPDATE]: [PERMISSIONS.STUDENTS_VIEW],
  [PERMISSIONS.STUDENTS_DELETE]: [PERMISSIONS.STUDENTS_VIEW],
  [PERMISSIONS.SUMMARY_CREATE]: [PERMISSIONS.SUMMARY_VIEW],
  [PERMISSIONS.SUMMARY_UPDATE]: [PERMISSIONS.SUMMARY_VIEW],
  [PERMISSIONS.SUMMARY_DELETE]: [PERMISSIONS.SUMMARY_VIEW],
  [PERMISSIONS.ACCOUNTS_UPDATE_ROLE]: [PERMISSIONS.ACCOUNTS_VIEW],
};

export const PERMISSION_GROUPS = [
  {
    module: 'dashboard',
    moduleName: '工作台',
    permissions: [
      { code: PERMISSIONS.DASHBOARD_VIEW, name: '查看工作台' },
    ],
  },
  {
    module: 'courses',
    moduleName: '课程管理',
    permissions: [
      { code: PERMISSIONS.COURSES_VIEW, name: '查看课程' },
      { code: PERMISSIONS.COURSES_CREATE, name: '新增课程' },
      { code: PERMISSIONS.COURSES_UPDATE, name: '编辑课程' },
      { code: PERMISSIONS.COURSES_DELETE, name: '删除课程' },
    ],
  },
  {
    module: 'students',
    moduleName: '学生管理',
    permissions: [
      { code: PERMISSIONS.STUDENTS_VIEW, name: '查看学生' },
      { code: PERMISSIONS.STUDENTS_CREATE, name: '新增学生' },
      { code: PERMISSIONS.STUDENTS_UPDATE, name: '编辑学生' },
      { code: PERMISSIONS.STUDENTS_DELETE, name: '删除学生' },
    ],
  },
  {
    module: 'summary',
    moduleName: '学习总结',
    permissions: [
      { code: PERMISSIONS.SUMMARY_VIEW, name: '查看总结' },
      { code: PERMISSIONS.SUMMARY_CREATE, name: '新增总结' },
      { code: PERMISSIONS.SUMMARY_UPDATE, name: '编辑总结' },
      { code: PERMISSIONS.SUMMARY_DELETE, name: '删除总结' },
    ],
  },
  {
    module: 'accounts',
    moduleName: '账号管理',
    permissions: [
      { code: PERMISSIONS.ACCOUNTS_VIEW, name: '查看账号' },
      { code: PERMISSIONS.ACCOUNTS_UPDATE_ROLE, name: '管理账号' },
    ],
  },
];

// 根据角色获取权限码列表
export function getPermissionsByRole(role) {
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}
