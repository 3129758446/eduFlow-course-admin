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
