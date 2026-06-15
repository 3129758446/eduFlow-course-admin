import assert from 'node:assert/strict';
import test from 'node:test';
import db from '../database/db.js';
import { initDatabase } from '../database/init.js';
import { PERMISSIONS } from '../permissions.js';
import { requirePermission } from './auth.js';
import { updateRolePermissions } from '../services/permission-service.js';

test('requirePermission uses dynamic role permissions from database', async () => {
  initDatabase();
  const teacher = db.prepare('SELECT id, role FROM users WHERE username = ?').get('teacher');
  const originalPermissions = db.prepare(`
    SELECT permission_code FROM role_permissions WHERE role_code = ?
  `).all('teacher').map((row) => row.permission_code);

  try {
    updateRolePermissions('teacher', [PERMISSIONS.DASHBOARD_VIEW]);

    const ctx = {
      state: { user: { id: teacher.id, role: teacher.role } },
      status: 200,
      body: null,
    };
    let nextCalled = false;

    await requirePermission(PERMISSIONS.COURSES_VIEW)(ctx, async () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(ctx.status, 403);
  } finally {
    updateRolePermissions('teacher', originalPermissions);
  }
});
