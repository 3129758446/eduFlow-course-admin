/* 
模块：认证中间件
定位：校验 Authorization: Bearer <token>，验证通过将用户写入 ctx.state.user
要点：统一使用 JWT_SECRET；失败时返回统一 JSON 错误
*/
import jwt from 'jsonwebtoken';
import { getPermissionsByRole } from '../permissions.js';

const JWT_SECRET = 'homework_secret_key_2024';

export { JWT_SECRET };

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

export function requirePermission(permission) {
  return async (ctx, next) => {
    const role = ctx.state.user?.role;
    const permissions = getPermissionsByRole(role);

    if (!permissions.includes(permission)) {
      ctx.status = 403;
      ctx.body = { code: 403, msg: '无权限执行该操作', data: null };
      return;
    }

    return next();
  };
}
