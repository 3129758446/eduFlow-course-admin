import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '../permissions.js';
import {
  getEffectivePermissions,
  listRoles,
  normalizePermissions,
  updateRolePermissions,
} from './permission-service.js';

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
