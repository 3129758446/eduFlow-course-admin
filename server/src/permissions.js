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
};

export const ROLE_PERMISSIONS = {
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
  ],
  viewer: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.SUMMARY_VIEW,
  ],
};

export function getPermissionsByRole(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}
