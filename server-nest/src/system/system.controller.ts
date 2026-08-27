// 文件作用：系统管理接口控制器，提供用户管理、角色管理和权限配置接口。
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { JwtUser } from '../auth/auth.types';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { fail } from '../common/api.exception';
import { ok } from '../common/api-response';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { SystemService } from './system.service';

interface AuthedRequest extends Request {
  user: JwtUser;
}

@Controller('api/system')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  // 作用：查询账号管理页用户列表。

  @Get('users')
  @RequirePermission(PERMISSIONS.ACCOUNTS_VIEW)
  async users() {
    return ok(await this.systemService.listUsers());
  }

  // 作用：修改某个用户的角色，接口层负责接收路由参数和请求体。

  @Patch('users/:id/role')
  @RequirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE)
  async updateUserRole(@Param('id') id: string, @Body() body: { role?: string }) {
    return ok(await this.systemService.updateUserRole(Number(id), String(body?.role ?? '').trim()));
  }

  // 作用：创建后台账号，并返回 201 状态码兼容旧 Koa 接口。

  @Post('users')
  @RequirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE)
  async createUser(@Body() body: { username?: string; name?: string; role?: string }, @Res({ passthrough: true }) res: Response) {
    res.status(201);
    return ok(await this.systemService.createUser(body), '账号创建成功，初始密码为 123456');
  }

  // 作用：删除后台账号，当前登录用户 ID 用于防止删除自己。

  @Delete('users/:id')
  @RequirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE)
  async deleteUser(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.systemService.deleteUser(Number(id), req.user.id);
    return ok(null, '账号删除成功');
  }

  // 作用：查询角色列表及每个角色的权限集合。

  @Get('roles')
  @RequirePermission(PERMISSIONS.ACCOUNTS_VIEW)
  async roles() {
    return ok(await this.systemService.listRoles());
  }

  // 作用：新增自定义角色，同时保存初始权限集合。

  @Post('roles')
  @RequirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE)
  async createRole(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; description?: string; permissions?: string[] },
    @Res({ passthrough: true }) res: Response,
  ) {
    // 作用：角色配置属于高风险操作，除权限码外还要求当前登录用户真实角色是 admin。
    if (req.user?.role !== 'admin') fail(403, '只有管理员可以新增角色');
    try {
      res.status(201);
      return ok(await this.systemService.createRole(body), '角色创建成功');
    } catch (error) {
      fail(400, error instanceof Error ? error.message : '角色创建失败');
    }
  }

  // 作用：修改角色名称和描述。

  @Patch('roles/:code')
  @RequirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE)
  async updateRoleInfo(@Req() req: AuthedRequest, @Param('code') code: string, @Body() body: { name?: string; description?: string }) {
    if (req.user?.role !== 'admin') fail(403, '只有管理员可以修改角色');
    try {
      return ok(await this.systemService.updateRoleInfo(code, body), '角色信息已更新');
    } catch (error) {
      fail(400, error instanceof Error ? error.message : '角色信息修改失败');
    }
  }

  // 作用：删除可删除的自定义角色。

  @Delete('roles/:code')
  @RequirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE)
  async deleteRole(@Req() req: AuthedRequest, @Param('code') code: string) {
    if (req.user?.role !== 'admin') fail(403, '只有管理员可以删除角色');
    try {
      await this.systemService.deleteRole(code);
      return ok(null, '角色删除成功');
    } catch (error) {
      fail(400, error instanceof Error ? error.message : '角色删除失败');
    }
  }

  // 作用：查询权限分组字典，供前端渲染权限配置面板。

  @Get('permissions')
  @RequirePermission(PERMISSIONS.ACCOUNTS_VIEW)
  permissions() {
    return ok(this.systemService.listPermissionGroups());
  }

  // 作用：保存角色权限配置，完成角色-权限映射更新。

  @Patch('roles/:code/permissions')
  @RequirePermission(PERMISSIONS.ACCOUNTS_UPDATE_ROLE)
  async updateRolePermissions(@Req() req: AuthedRequest, @Param('code') code: string, @Body() body: { permissions?: string[] }) {
    if (req.user?.role !== 'admin') fail(403, '只有管理员可以修改角色权限');
    try {
      return ok(await this.systemService.updateRolePermissions(code, body?.permissions));
    } catch (error) {
      fail(400, error instanceof Error ? error.message : '角色权限修改失败');
    }
  }
}
