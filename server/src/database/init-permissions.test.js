import assert from 'node:assert/strict';
import test from 'node:test';
import db from './db.js';
import { initDatabase } from './init.js';
import { PERMISSIONS } from '../permissions.js';

test('database initialization creates editable roles and default teacher permissions', () => {
  initDatabase();

  const teacherRole = db.prepare('SELECT code, editable FROM roles WHERE code = ?').get('teacher');
  assert.deepEqual(teacherRole, { code: 'teacher', editable: 1 });

  const courseViewPermission = db
    .prepare('SELECT code, module FROM permissions WHERE code = ?')
    .get(PERMISSIONS.COURSES_VIEW);
  assert.deepEqual(courseViewPermission, {
    code: PERMISSIONS.COURSES_VIEW,
    module: 'courses',
  });

  const teacherCourseView = db.prepare(`
    SELECT permission_code FROM role_permissions
    WHERE role_code = ? AND permission_code = ?
  `).get('teacher', PERMISSIONS.COURSES_VIEW);
  assert.deepEqual(teacherCourseView, { permission_code: PERMISSIONS.COURSES_VIEW });
});
