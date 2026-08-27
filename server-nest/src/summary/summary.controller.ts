// 文件作用：学习总结接口控制器，按当前登录用户提供总结的查询、新增、编辑和删除接口。
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { JwtUser } from '../auth/auth.types';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { ok } from '../common/api-response';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { SummaryService } from './summary.service';

interface AuthedRequest extends Request {
  user: JwtUser;
}

@Controller('api/summary')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  // 作用：查询当前用户自己的学习总结列表。

  @Get()
  @RequirePermission(PERMISSIONS.SUMMARY_VIEW)
  async list(@Req() req: AuthedRequest, @Query() query: Record<string, string>) {
    return ok(await this.summaryService.list(req.user.id, query));
  }

  // 作用：查询当前用户自己的单条学习总结详情。

  @Get(':id')
  @RequirePermission(PERMISSIONS.SUMMARY_VIEW)
  async detail(@Req() req: AuthedRequest, @Param('id') id: string) {
    return ok(await this.summaryService.detail(id, req.user.id));
  }

  // 作用：创建当前用户的学习总结，成功时保持旧 Koa 接口的 201 状态码。

  @Post()
  @RequirePermission(PERMISSIONS.SUMMARY_CREATE)
  async create(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>, @Res({ passthrough: true }) res: Response) {
    res.status(201);
    return ok(await this.summaryService.create(req.user.id, body));
  }

  // 作用：编辑当前用户自己的学习总结。

  @Put(':id')
  @RequirePermission(PERMISSIONS.SUMMARY_UPDATE)
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return ok(await this.summaryService.update(id, req.user.id, body));
  }

  // 作用：删除当前用户自己的学习总结。

  @Delete(':id')
  @RequirePermission(PERMISSIONS.SUMMARY_DELETE)
  async delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.summaryService.delete(id, req.user.id);
    return ok(null, '删除成功');
  }
}
