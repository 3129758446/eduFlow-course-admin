/*
模块：系统管理路由
定位：提供账号管理接口和固定角色列表
安全：所有接口都先 authenticateToken，再通过 requirePermission 做接口级鉴权
*/
import Router from '@koa/router';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { DEFAULT_ROLES, MANAGED_ROLES, PERMISSIONS } from '../permissions.js';
import { success, fail } from '../utils/response.js';

const router = new Router();
const INITIAL_PASSWORD = '123456';
const PUBLIC_USER_FIELDS = 'id, username, name, role, avatar, created_at';

// 账号管理：仅返回前端展示需要的字段，避免 password 泄漏。
// 仅返回教师和学生账号，不返回管理员账号。
// 分页查询，默认每页 10 条。
router.get('/users', authenticateToken, requirePermission(PERMISSIONS.ACCOUNTS_VIEW), async (ctx) => {
  const users = db.prepare(`
    SELECT ${PUBLIC_USER_FIELDS}
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

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  success(ctx, findPublicUserById(userId));
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

  ctx.status = 201;
  success(ctx, findPublicUserById(result.lastInsertRowid), `账号创建成功，初始密码为 ${INITIAL_PASSWORD}`);
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

// 账号管理只需要固定角色列表来渲染下拉框，不再提供角色权限动态配置。
router.get('/roles', authenticateToken, requirePermission(PERMISSIONS.ACCOUNTS_VIEW), async (ctx) => {
  success(ctx, DEFAULT_ROLES);
});

function findPublicUserById(id) {
  // 账号接口统一复用这份查询，保证返回字段始终不包含 password。
  return db.prepare(`SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ?`).get(id);
}

export default router;
