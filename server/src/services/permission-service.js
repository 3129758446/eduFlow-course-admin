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
const CUSTOM_ROLE_PREFIX = 'custom_';

export function normalizePermissions(inputPermissions = []) {
  const result = new Set();

  for (const permission of inputPermissions) {
    if (!ALL_PERMISSIONS.includes(permission)) continue;
    result.add(permission);

    // 写操作必须补齐对应查看权限，避免出现“能编辑但进不了页面”的权限组合。
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
  // 管理员不依赖 role_permissions，防止数据库误删权限后系统无人可管。
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
      SELECT code, name, description, editable, builtin, deletable
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
      builtin: Boolean(role.builtin),
      deletable: Boolean(role.deletable) && !IMMUTABLE_ROLES.includes(role.code),
      userCount: countUsersByRole(role.code),
      permissions: getPermissionsByRole(role.code),
    }));
  } catch (error) {
    if (error.code !== 'SQLITE_ERROR') {
      throw error;
    }

    return DEFAULT_ROLES.map((role) => ({
      ...role,
      editable: !IMMUTABLE_ROLES.includes(role.code),
      builtin: true,
      deletable: false,
      userCount: 0,
      permissions: getPermissionsByRole(role.code),
    }));
  }
}

export function createRole({ name, description = '', permissions = [] } = {}) {
  const normalizedName = normalizeRoleName(name);
  const validation = validatePermissions(permissions);
  if (!validation.valid) {
    throw new Error(`权限码不存在: ${validation.invalid.join(', ')}`);
  }

  const roleCode = createUniqueRoleCode();
  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO roles (code, name, description, editable, builtin, deletable, updated_at)
      VALUES (?, ?, ?, 1, 0, 1, CURRENT_TIMESTAMP)
    `).run(roleCode, normalizedName, String(description ?? '').trim());
    replaceRolePermissions(roleCode, normalizePermissions(permissions));
  });

  create();
  return getRoleByCode(roleCode);
}

export function updateRoleInfo(roleCode, { name, description } = {}) {
  const role = requireExistingRole(roleCode);
  const nextName = name === undefined ? role.name : normalizeRoleName(name);
  const nextDescription =
    description === undefined ? role.description : String(description ?? '').trim();

  // 系统默认角色的 code/name 是业务约定，允许改名会让页面文案和默认数据难以追踪。
  if (role.builtin && nextName !== role.name) {
    throw new Error('系统默认角色名称不可修改');
  }

  db.prepare(`
    UPDATE roles
    SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ?
  `).run(nextName, nextDescription, roleCode);

  return getRoleByCode(roleCode);
}

export function deleteRole(roleCode) {
  const role = requireExistingRole(roleCode);
  if (!role.deletable || role.builtin || IMMUTABLE_ROLES.includes(roleCode)) {
    throw new Error('系统默认角色不可删除');
  }

  // 删除角色前必须先转移用户，避免账号登录后找不到权限来源。
  const userCount = countUsersByRole(roleCode);
  if (userCount > 0) {
    throw new Error(`该角色下还有用户，请先转移 ${userCount} 个用户后再删除`);
  }

  db.prepare('DELETE FROM roles WHERE code = ?').run(roleCode);
}

export function canAssignRole(roleCode) {
  if (IMMUTABLE_ROLES.includes(roleCode)) return false;
  return Boolean(db.prepare('SELECT code FROM roles WHERE code = ?').get(roleCode));
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

  replaceRolePermissions(roleCode, normalized);
  return getPermissionsByRole(roleCode);
}

function getRoleByCode(roleCode) {
  return listRoles().find((role) => role.code === roleCode) ?? null;
}

function requireExistingRole(roleCode) {
  const role = db.prepare(`
    SELECT code, name, description, editable, builtin, deletable
    FROM roles
    WHERE code = ?
  `).get(roleCode);
  if (!role) {
    throw new Error('角色不存在');
  }
  return {
    ...role,
    editable: Boolean(role.editable),
    builtin: Boolean(role.builtin),
    deletable: Boolean(role.deletable),
  };
}

function normalizeRoleName(name) {
  const normalized = String(name ?? '').trim();
  if (!normalized) {
    throw new Error('角色名称不能为空');
  }
  if (normalized.length > 30) {
    throw new Error('角色名称不能超过 30 个字符');
  }
  return normalized;
}

function createUniqueRoleCode() {
  for (let index = 0; index < 5; index += 1) {
    // code 是内部稳定标识，界面统一显示 custom，避免暴露随机后缀。
    const code = `${CUSTOM_ROLE_PREFIX}${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const exists = db.prepare('SELECT code FROM roles WHERE code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('角色编码生成失败，请重试');
}

function countUsersByRole(roleCode) {
  return db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(roleCode).count;
}

function replaceRolePermissions(roleCode, permissions) {
  const replacePermissions = db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode);
    const insert = db.prepare(`
      INSERT INTO role_permissions (role_code, permission_code)
      VALUES (?, ?)
    `);

    for (const permission of permissions) {
      insert.run(roleCode, permission);
    }
  });

  replacePermissions();
}
