/* 
模块：认证中间件
定位：校验 Authorization: Bearer <token>，验证通过将用户写入 ctx.state.user
要点：统一使用 JWT_SECRET；失败时返回统一 JSON 错误
*/
import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { getEffectivePermissions } from '../services/permission-service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'homework_secret_key_2024';

export { JWT_SECRET };

// 认证中间件：校验 Authorization: Bearer <token>，验证通过将用户写入 ctx.state.user
export function authenticateToken(ctx, next) {
  const authHeader = ctx.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    ctx.status = 401;
    ctx.body = { code: 401, msg: '未提供认证令牌', data: null };
    return;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    ctx.state.user = user;
    return next();
  } catch {
    ctx.status = 401;
    ctx.body = { code: 401, msg: '令牌无效或已过期', data: null };
  }
}
// 权限中间件：每次请求都按数据库中的当前角色权限判断，确保权限修改立即生效。
export function requirePermission(permission) {
  return async (ctx, next) => {
    const userId = ctx.state.user?.id;
    // JWT 只承载身份，真实 role 重新查库，避免旧 token 携带过期角色信息。
    const user = db.prepare('SELECT id, username, name, role FROM users WHERE id = ?').get(userId);

    if (!user) {
      ctx.status = 401;
      ctx.body = { code: 401, msg: '用户不存在', data: null };
      return;
    }

    const permissions = getEffectivePermissions(user);

    if (!permissions.includes(permission)) {
      ctx.status = 403;
      ctx.body = { code: 403, msg: '无权限执行该操作', data: null };
      return;
    }

    return next();
  };
}
