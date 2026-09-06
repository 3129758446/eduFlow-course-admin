// 文件作用：认证接口控制器，提供登录、获取当前用户和修改当前用户密码接口。
import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ok } from '../common/api-response';
import { JwtAuthGuard } from './auth.guard';
import { JwtUser } from './auth.types';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

interface AuthedRequest extends Request {
  user: JwtUser;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 作用：处理登录请求，返回 token 和用户权限集合，供前端初始化登录态。

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body);
    // Refresh Token 只通过 HttpOnly Cookie 下发，响应体只暴露短期 Access Token。
    setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return ok({ token: result.token, user: result.user });
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.refresh(readCookie(request, REFRESH_COOKIE_NAME) ?? '');
    // 服务端轮换 Refresh Token 后必须覆盖 Cookie，旧 Token 不再可用。
    setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return ok({ token: result.token, user: result.user });
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(readCookie(request, REFRESH_COOKIE_NAME));
    response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    return ok(null);
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() request: AuthedRequest, @Res({ passthrough: true }) response: Response) {
    await this.authService.logoutAll(request.user.id);
    response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    return ok(null);
  }

  // 作用：根据 token 获取当前用户信息，刷新页面时恢复用户和权限状态。

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthedRequest) {
    return ok(await this.authService.getCurrentUser(req.user.id));
  }

  // 作用：修改当前登录用户密码，不允许前端指定其他用户。

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  async password(@Req() req: AuthedRequest, @Body() body: ChangePasswordDto) {
    await this.authService.changePassword(req.user.id, body);
    return ok(null, '密码修改成功');
  }
}

const REFRESH_COOKIE_NAME = 'course_admin_refresh_token';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isRefreshCookieSecure(),
    sameSite: 'lax' as const,
    path: '/api/auth',
  };
}

function isRefreshCookieSecure() {
  // 本地 HTTP 开发显式设为 false；未配置时生产环境默认开启 Secure。
  const configured = process.env.COOKIE_SECURE?.trim().toLowerCase();
  return configured === undefined || configured === ''
    ? process.env.NODE_ENV === 'production'
    : configured === 'true';
}

function setRefreshCookie(response: Response, token: string, expiresAt: Date) {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(),
    // Cookie 生命周期与服务端闲置过期时间对齐；服务端会话表仍是最终校验依据。
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
