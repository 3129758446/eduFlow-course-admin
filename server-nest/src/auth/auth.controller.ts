// 文件作用：认证接口控制器，提供登录、获取当前用户和修改当前用户密码接口。
import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ok } from '../common/api-response';
import { JwtAuthGuard } from './auth.guard';
import { JwtUser } from './auth.types';
import { AuthService } from './auth.service';

interface AuthedRequest extends Request {
  user: JwtUser;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 作用：处理登录请求，返回 token 和用户权限集合，供前端初始化登录态。

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { username?: string; password?: string }) {
    return ok(await this.authService.login(body));
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
  async password(@Req() req: AuthedRequest, @Body() body: { oldPassword?: string; newPassword?: string }) {
    await this.authService.changePassword(req.user.id, body);
    return ok(null, '密码修改成功');
  }
}
