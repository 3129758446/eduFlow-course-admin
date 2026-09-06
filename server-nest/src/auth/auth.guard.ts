// 文件作用：JWT 鉴权守卫，校验 Authorization token 并把登录用户信息挂载到请求对象。
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { fail } from '../common/api.exception';
import { JwtUser } from './auth.types';
import { AuthService } from './auth.service';

export const JWT_SECRET = 'homework_secret_key_2024';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  // 作用：校验 Authorization Bearer token，并把 JWT 中的身份信息挂到 req.user。
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: JwtUser }>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) fail(401, '未提供认证令牌');

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET) as JwtUser;
      // 签名和有效期通过后仍校验会话状态，使退出登录、改密码可立即废弃旧 Access Token。
      if (user.type !== 'access' || !user.sessionId || !(await this.authService.isSessionActive(user.sessionId))) {
        fail(401, '登录会话已失效，请重新登录');
      }
      request.user = user;
      return true;
    } catch {
      fail(401, '令牌无效或已过期');
    }
  }
}
