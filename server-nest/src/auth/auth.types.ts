// 文件作用：定义 JWT 用户载荷和带登录用户信息的请求类型。
import { Request } from 'express';

export interface JwtUser {
  id: number;
  username: string;
  role: string;
  name: string;
  sessionId: string;
  type: 'access';
}

export interface RequestWithUser extends Request {
  user?: JwtUser;
}
