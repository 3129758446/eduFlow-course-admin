/*
模块：权限字典与角色权限读取
定位：集中维护默认权限、默认角色和默认角色权限，并为登录/接口鉴权提供 getPermissionsByRole
说明：DEFAULT_* 只用于数据库初始化和兜底；系统运行时优先读取 roles/permissions/role_permissions 表。
*/
import db from './database/db.js';

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
  ROLES_VIEW: 'roles:view',
  ROLES_UPDATE_PERMISSIONS: 'roles:updatePermissions',
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
      { code: PERMISSIONS.COURSES_VIEW, name: '查看课程列表' },
      { code: PERMISSIONS.COURSES_CREATE, name: '新增课程' },
      { code: PERMISSIONS.COURSES_UPDATE, name: '编辑课程/发布课程' },
      { code: PERMISSIONS.COURSES_DELETE, name: '删除课程' },
    ],
  },
  {
    module: 'students',
    moduleName: '学生管理',
    permissions: [
      { code: PERMISSIONS.STUDENTS_VIEW, name: '查看学生列表' },
      { code: PERMISSIONS.STUDENTS_CREATE, name: '新增学生' },
      { code: PERMISSIONS.STUDENTS_UPDATE, name: '编辑学生' },
      { code: PERMISSIONS.STUDENTS_DELETE, name: '删除学生' },
    ],
  },
  {
    module: 'summary',
    moduleName: '学习总结',
    permissions: [
      { code: PERMISSIONS.SUMMARY_VIEW, name: '查看学习总结' },
      { code: PERMISSIONS.SUMMARY_CREATE, name: '新增学习总结' },
      { code: PERMISSIONS.SUMMARY_UPDATE, name: '编辑学习总结' },
      { code: PERMISSIONS.SUMMARY_DELETE, name: '删除学习总结' },
    ],
  },
  {
    module: 'system',
    moduleName: '系统管理',
    permissions: [
      { code: PERMISSIONS.ACCOUNTS_VIEW, name: '查看账号管理' },
      { code: PERMISSIONS.ACCOUNTS_UPDATE_ROLE, name: '修改账号角色' },
      { code: PERMISSIONS.ROLES_VIEW, name: '查看角色权限' },
      { code: PERMISSIONS.ROLES_UPDATE_PERMISSIONS, name: '修改角色权限' },
    ],
  },
];

export const DEFAULT_ROLES = [
  { code: 'admin', name: '管理员', description: '拥有全部权限' },
  { code: 'teacher', name: '教师', description: '可维护课程和学生，不可删除' },
  { code: 'student', name: '学生', description: '只读访问学习管理平台' },
];

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
  // 管理员是系统最高权限角色，始终拥有完整权限，不受页面配置影响，避免误操作把管理员锁死。
  if (role === 'admin') {
    return DEFAULT_ROLE_PERMISSIONS.admin;
  }

  try {
    // 角色存在时，即使它没有任何权限，也应该返回空数组，而不是回退到默认权限。
    const existingRole = db.prepare('SELECT id FROM roles WHERE code = ?').get(role);
    if (!existingRole) {
      return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
    }

    const rows = db.prepare(`
      SELECT p.code FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      JOIN roles r ON r.id = rp.role_id
      WHERE r.code = ?
      ORDER BY p.sort_order ASC, p.id ASC
    `).all(role);

    return rows.map((row) => row.code);
  } catch {
    // 初始化早期表还没创建时，登录和鉴权可能会先调用这里，使用默认配置保证系统能启动。
    return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
  }
}
