// 文件作用：上传接口控制器，提供学习总结图片上传入口并受 JWT 鉴权保护。
import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { JwtUser } from '../auth/auth.types';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { ok } from '../common/api-response';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { UploadService } from './upload.service';

interface AuthedRequest extends Request {
  user: JwtUser;
}

@Controller('api/upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // 作用：上传学习总结图片，并返回可写入 Markdown 的静态访问地址。

  @Post('summary-image')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.SUMMARY_CREATE)
  async uploadSummaryImage(@Req() req: AuthedRequest) {
    return ok(await this.uploadService.uploadSummaryImage(req, req.user.id));
  }
}
