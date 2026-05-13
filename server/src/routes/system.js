/*
模块：系统管理路由
定位：提供账号角色调整和角色权限配置接口
安全：所有接口都先 authenticateToken，再通过 requirePermission 做接口级鉴权
*/
import Router from '@koa/router';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../permissions.js';
import { success, fail } from '../utils/response.js';

const router = new Router();
const MANAGED_ROLES = ['teacher', 'student'];
const INITIAL_PASSWORD = '123456';

// 账号管理：仅返回前端展示需要的字段，避免 password 泄漏。
router.get('/users', authenticateToken, requirePermission(PERMISSIONS.ACCOUNTS_VIEW), async (ctx) => {
  const users = db.prepare(`
    SELECT id, username, name, role, avatar, created_at
    FROM users
    ORDER BY id ASC
  `).all();

  success(ctx, users);
});

// 修改账号角色：第一版只允许切换已有角色，不在这里创建新角色。
router.patch('/users/:id/role', authenticateToken, requirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE), async (ctx) => {
  const userId = Number(ctx.params.id);
  const role = String(ctx.request.body?.role ?? '').trim();

  if (!Number.isInteger(userId) || userId <= 0) {
    return fail(ctx, 400, '用户 ID 不合法');
  }

  const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
  if (!targetUser) {
    return fail(ctx, 404, '用户不存在');
  }
  if (targetUser.role === 'admin') {
    return fail(ctx, 400, '管理员账号角色不可修改');
  }
  if (!MANAGED_ROLES.includes(role)) {
    return fail(ctx, 400, '只能分配教师或学生角色');
  }

  const targetRole = db.prepare('SELECT code FROM roles WHERE code = ?').get(role);
  if (!targetRole) {
    return fail(ctx, 400, '角色不存在');
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  const user = db.prepare('SELECT id, username, name, role, avatar, created_at FROM users WHERE id = ?').get(userId);
  success(ctx, user);
});

router.post('/users', authenticateToken, requirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE), async (ctx) => {
  const username = String(ctx.request.body?.username ?? '').trim();
  const name = String(ctx.request.body?.name ?? '').trim();
  const role = String(ctx.request.body?.role ?? '').trim();

  if (!username || !name || !role) {
    return fail(ctx, 400, '账号、姓名和角色不能为空');
  }
  if (!MANAGED_ROLES.includes(role)) {
    return fail(ctx, 400, '只能新增教师或学生账号');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return fail(ctx, 400, '账号已存在');
  }

  const result = db.prepare(`
    INSERT INTO users (username, password, name, role)
    VALUES (?, ?, ?, ?)
  `).run(username, bcrypt.hashSync(INITIAL_PASSWORD, 10), name, role);

  const user = db.prepare('SELECT id, username, name, role, avatar, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  ctx.status = 201;
  success(ctx, user, `账号创建成功，初始密码为 ${INITIAL_PASSWORD}`);
});

router.delete('/users/:id', authenticateToken, requirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE), async (ctx) => {
  const userId = Number(ctx.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return fail(ctx, 400, '用户 ID 不合法');
  }
  if (userId === ctx.state.user.id) {
    return fail(ctx, 400, '不能删除当前登录账号');
  }

  const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
  if (!targetUser) {
    return fail(ctx, 404, '用户不存在');
  }
  if (!MANAGED_ROLES.includes(targetUser.role)) {
    return fail(ctx, 400, '只能删除教师或学生账号');
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  success(ctx, null, '账号删除成功');
});

// 角色权限页需要两类数据：角色当前拥有的权限，以及完整权限字典。
router.get('/roles', authenticateToken, requirePermission(PERMISSIONS.ROLES_VIEW), async (ctx) => {
  const roles = db.prepare(`
    SELECT id, code, name, description, created_at
    FROM roles
    ORDER BY id ASC
  `).all();
  const permissions = db.prepare(`
    SELECT id, code, name, module, module_name, sort_order
    FROM permissions
    ORDER BY sort_order ASC, id ASC
  `).all();
  const rolePermissions = db.prepare(`
    SELECT r.code AS role, p.code AS permission
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    ORDER BY r.id ASC, p.sort_order ASC, p.id ASC
  `).all();
  // 将多对多查询结果整理成 { [roleCode]: permissionCode[] }，方便前端直接回填 Checkbox。
  const permissionMap = rolePermissions.reduce((map, row) => {
    if (!map[row.role]) {
      map[row.role] = [];
    }
    map[row.role].push(row.permission);
    return map;
  }, {});

  success(ctx, {
    roles: roles.map((role) => ({
      ...role,
      permissions:
        role.code === 'admin'
          ? Object.values(PERMISSIONS)
          : permissionMap[role.code] ?? [],
    })),
    permissions,
  });
});

// 保存某个角色的权限：先校验权限码合法性，再用事务整体替换，避免只更新一半。
router.put('/roles/:code/permissions', authenticateToken, requirePermission(PERMISSIONS.ROLES_UPDATE_PERMISSIONS), async (ctx) => {
  const roleCode = String(ctx.params.code ?? '').trim();
  const permissionCodes = normalizePermissionCodes(ctx.request.body?.permissions);

  if (!permissionCodes) {
    return fail(ctx, 400, 'permissions 必须是字符串数组');
  }

  const role = db.prepare('SELECT id, code FROM roles WHERE code = ?').get(roleCode);
  if (!role) {
    return fail(ctx, 404, '角色不存在');
  }
  if (role.code === 'admin') {
    return fail(ctx, 400, '管理员权限不可修改');
  }

  const permissions = permissionCodes.length
    ? db.prepare(`SELECT id, code FROM permissions WHERE code IN (${permissionCodes.map(() => '?').join(',')})`).all(...permissionCodes)
    : [];
  const validCodes = new Set(permissions.map((permission) => permission.code));
  const invalidCodes = permissionCodes.filter((code) => !validCodes.has(code));

  if (invalidCodes.length > 0) {
    return fail(ctx, 400, `权限不存在：${invalidCodes.join(', ')}`);
  }

  const update = db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
    const insert = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const permission of permissions) {
      insert.run(role.id, permission.id);
    }
  });
  update();

  success(ctx, {
    role: role.code,
    permissions: permissionCodes,
  });
});

function normalizePermissionCodes(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const codes = [];
  for (const item of value) {
    const code = String(item).trim();
    if (!code) {
      return null;
    }
    if (!codes.includes(code)) {
      codes.push(code);
    }
  }

  return codes;
}

export default router;
