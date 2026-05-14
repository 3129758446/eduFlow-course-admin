/* 
模块：认证路由
接口：
- POST /api/auth/login 账号密码登录，成功返回 { token, user }
- GET  /api/auth/me    获取当前用户信息（需鉴权）
要点：密码使用 bcrypt 校验；签发 7 天有效期的 JWT
*/
import Router from '@koa/router';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';
import { getPermissionsByRole } from '../permissions.js';
import { success, fail } from '../utils/response.js';

const router = new Router(); // 认证路由
// 登录接口
router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;

  if (!username || !password) {
    return fail(ctx, 400, '请输入用户名和密码');
  }

  // 用户名不存在和密码错误都返回相同提示，避免暴露账号是否存在。
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return fail(ctx, 401, '用户名或密码错误');
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return fail(ctx, 401, '用户名或密码错误');
  }

  // 签发 JWT
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 返回前剔除 password 字段，避免敏感信息泄漏到前端。
  const { password: _, ...userInfo } = user; 
  userInfo.permissions = getPermissionsByRole(user.role);  // 添加权限字段
  success(ctx, { token, user: userInfo });
});

// 获取当前用户信息接口
router.get('/me', authenticateToken, async (ctx) => {
  // /me 的作用是“用 token 换当前用户信息”，前端冷启动时会依赖它恢复登录态。
  const user = db.prepare('SELECT id, username, name, role, avatar, created_at FROM users WHERE id = ?').get(ctx.state.user.id);
  if (!user) {
    return fail(ctx, 404, '用户不存在');
  }
  user.permissions = getPermissionsByRole(user.role);  // 添加权限字段
  success(ctx, user);
});

// 更新密码接口
router.patch('/password', authenticateToken, async (ctx) => {
  const oldPassword = String(ctx.request.body?.oldPassword ?? '');
  const newPassword = String(ctx.request.body?.newPassword ?? '');

  if (!oldPassword || !newPassword) {
    return fail(ctx, 400, '原密码和新密码不能为空');
  }
  if (newPassword.length < 6) {
    return fail(ctx, 400, '新密码至少需要 6 位');
  }

  const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(ctx.state.user.id);
  if (!user) {
    return fail(ctx, 404, '用户不存在');
  }
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return fail(ctx, 400, '原密码不正确');
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?')
    .run(bcrypt.hashSync(newPassword, 10), user.id);
  success(ctx, null, '密码修改成功');
});

export default router;
