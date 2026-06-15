import assert from 'node:assert/strict';
import test from 'node:test';
import db from '../database/db.js';
import { initDatabase } from '../database/init.js';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '../permissions.js';
import {
  createRole,
  deleteRole,
  getEffectivePermissions,
  listRoles,
  normalizePermissions,
  updateRoleInfo,
  updateRolePermissions,
} from './permission-service.js';

initDatabase();

test('normalizes operation permissions by adding required view permissions', () => {
  assert.deepEqual(
    normalizePermissions([PERMISSIONS.COURSES_UPDATE]).sort(),
    [PERMISSIONS.COURSES_VIEW, PERMISSIONS.COURSES_UPDATE].sort(),
  );
});

test('admin effective permissions always include every permission', () => {
  assert.deepEqual(
    getEffectivePermissions({ id: 1, role: 'admin' }).sort(),
    Object.values(PERMISSIONS).sort(),
  );
});

test('non-admin effective permissions fall back to default role permissions without database access', () => {
  assert.deepEqual(
    getEffectivePermissions({ id: 2, role: 'teacher' }).sort(),
    DEFAULT_ROLE_PERMISSIONS.teacher.sort(),
  );
});

test('admin role permissions cannot be updated', () => {
  assert.throws(
    () => updateRolePermissions('admin', [PERMISSIONS.COURSES_VIEW]),
    /管理员权限不可修改/,
  );
});

test('role list includes editable flag and effective permissions', () => {
  const roles = listRoles();
  const admin = roles.find((role) => role.code === 'admin');
  assert.equal(admin.editable, false);
  assert.equal(admin.permissions.length, Object.values(PERMISSIONS).length);
});

test('custom roles can be created and renamed', () => {
  const role = createRole({
    name: '助教',
    description: '辅助教师管理课程',
    permissions: [PERMISSIONS.COURSES_UPDATE],
  });

  assert.equal(role.builtin, false);
  assert.equal(role.deletable, true);
  assert.equal(role.name, '助教');
  assert.deepEqual(
    role.permissions.sort(),
    [PERMISSIONS.COURSES_VIEW, PERMISSIONS.COURSES_UPDATE].sort(),
  );

  const renamed = updateRoleInfo(role.code, {
    name: '课程助教',
    description: '协助维护课程内容',
  });
  assert.equal(renamed.name, '课程助教');
  assert.equal(renamed.description, '协助维护课程内容');

  deleteRole(role.code);
});

test('builtin role names cannot be changed', () => {
  assert.throws(
    () => updateRoleInfo('teacher', { name: '讲师' }),
    /系统默认角色名称不可修改/,
  );
});

test('custom role with users cannot be deleted', () => {
  const role = createRole({ name: '临时角色', permissions: [] });
  const username = `role_test_${Date.now()}`;

  db.prepare(`
    INSERT INTO users (username, password, name, role)
    VALUES (?, ?, ?, ?)
  `).run(username, 'test-password', '角色测试用户', role.code);

  try {
    assert.throws(
      () => deleteRole(role.code),
      /该角色下还有用户/,
    );
  } finally {
    db.prepare('DELETE FROM users WHERE username = ?').run(username);
    deleteRole(role.code);
  }
});
