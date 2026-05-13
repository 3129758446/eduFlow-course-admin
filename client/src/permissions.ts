/*
模块：前端权限码常量
定位：集中维护页面、菜单、按钮和路由使用的权限码，避免业务组件散落裸字符串
约定：权限码格式为 module:action，例如 courses:create
*/
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  COURSES_VIEW: "courses:view",
  COURSES_CREATE: "courses:create",
  COURSES_UPDATE: "courses:update",
  COURSES_DELETE: "courses:delete",
  STUDENTS_VIEW: "students:view",
  STUDENTS_CREATE: "students:create",
  STUDENTS_UPDATE: "students:update",
  STUDENTS_DELETE: "students:delete",
  SUMMARY_VIEW: "summary:view",
  SUMMARY_CREATE: "summary:create",
  SUMMARY_UPDATE: "summary:update",
  SUMMARY_DELETE: "summary:delete",
  ACCOUNTS_VIEW: "accounts:view",
  ACCOUNTS_UPDATE_ROLE: "accounts:updateRole",
  ROLES_VIEW: "roles:view",
  ROLES_UPDATE_PERMISSIONS: "roles:updatePermissions",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  permissions: readonly string[] | undefined,
  code: PermissionCode,
) {
  return Boolean(permissions?.includes(code));
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  codes: readonly PermissionCode[],
) {
  return codes.some((code) => hasPermission(permissions, code));
}
