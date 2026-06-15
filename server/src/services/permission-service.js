import db from '../database/db.js';
import {
  DEFAULT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  IMMUTABLE_ROLES,
  PERMISSION_DEPENDENCIES,
  PERMISSION_GROUPS,
  PERMISSIONS,
} from '../permissions.js';

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export function normalizePermissions(inputPermissions = []) {
  const result = new Set();

  for (const permission of inputPermissions) {
    if (!ALL_PERMISSIONS.includes(permission)) continue;
    result.add(permission);

    const dependencies = PERMISSION_DEPENDENCIES[permission] ?? [];
    for (const dependency of dependencies) {
      result.add(dependency);
    }
  }

  return [...result];
}

export function validatePermissions(inputPermissions = []) {
  const invalid = inputPermissions.filter((permission) => !ALL_PERMISSIONS.includes(permission));
  return {
    valid: invalid.length === 0,
    invalid,
  };
}

export function getPermissionsByRole(roleCode) {
  if (IMMUTABLE_ROLES.includes(roleCode)) {
    return ALL_PERMISSIONS;
  }

  try {
    const rows = db.prepare(`
      SELECT permission_code FROM role_permissions
      WHERE role_code = ?
      ORDER BY permission_code ASC
    `).all(roleCode);
    return rows.map((row) => row.permission_code);
  } catch (error) {
    if (error.code !== 'SQLITE_ERROR') {
      throw error;
    }
    return DEFAULT_ROLE_PERMISSIONS[roleCode] ?? [];
  }
}

export function getEffectivePermissions(user) {
  return getPermissionsByRole(user?.role);
}

export function listPermissionGroups() {
  return PERMISSION_GROUPS;
}

export function listRoles() {
  try {
    return db.prepare(`
      SELECT code, name, description, editable
      FROM roles
      ORDER BY
        CASE code
          WHEN 'admin' THEN 1
          WHEN 'teacher' THEN 2
          WHEN 'student' THEN 3
          WHEN 'custom' THEN 4
          ELSE 5
        END,
        code ASC
    `).all().map((role) => ({
      ...role,
      editable: Boolean(role.editable) && !IMMUTABLE_ROLES.includes(role.code),
      permissions: getPermissionsByRole(role.code),
    }));
  } catch (error) {
    if (error.code !== 'SQLITE_ERROR') {
      throw error;
    }

    return DEFAULT_ROLES.map((role) => ({
      ...role,
      editable: !IMMUTABLE_ROLES.includes(role.code),
      permissions: getPermissionsByRole(role.code),
    }));
  }
}

export function updateRolePermissions(roleCode, permissions = []) {
  if (IMMUTABLE_ROLES.includes(roleCode)) {
    throw new Error('管理员权限不可修改');
  }

  const role = db.prepare('SELECT code, editable FROM roles WHERE code = ?').get(roleCode);
  if (!role) {
    throw new Error('角色不存在');
  }
  if (!role.editable) {
    throw new Error('该角色权限不可修改');
  }

  const validation = validatePermissions(permissions);
  if (!validation.valid) {
    throw new Error(`权限码不存在: ${validation.invalid.join(', ')}`);
  }

  const normalized = normalizePermissions(permissions);

  const replacePermissions = db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode);
    const insert = db.prepare(`
      INSERT INTO role_permissions (role_code, permission_code)
      VALUES (?, ?)
    `);

    for (const permission of normalized) {
      insert.run(roleCode, permission);
    }
  });

  replacePermissions();
  return getPermissionsByRole(roleCode);
}
