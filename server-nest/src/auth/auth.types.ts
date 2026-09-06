// 文件作用：定义 JWT 用户载荷和带登录用户信息的请求类型。
import { Request } from 'express';

export interface JwtUser {
  id: number;
  username: string;
  role: string;
  name: string;
  // Access Token 绑定的服务端会话 ID，用于让退出或改密即时失效。
  sessionId: string;
  // 将令牌用途写入载荷，Guard 只接受 Access Token。
  type: 'access';
}

export interface RequestWithUser extends Request {
  user?: JwtUser;
}
