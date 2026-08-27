// 文件作用：RBAC 权限守卫，读取接口所需权限码并按用户最新角色权限执行接口级鉴权。
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fail } from '../common/api.exception';
import { DatabaseService } from '../database/database.service';
import { PermissionService } from '../permissions/permission.service';
import { JwtUser } from './auth.types';

export const PERMISSION_KEY = 'permission';

// 作用：给 Controller 路由标记需要的权限码，PermissionsGuard 会读取这个元数据做接口鉴权。
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
    private readonly permissionService: PermissionService,
  ) {}

  // 作用：每次请求都重新查询用户最新角色和权限，保证管理员修改权限后旧 token 也立即按新权限鉴权。

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const userId = request.user?.id;
    const user = await this.database.get<{ id: number; username: string; name: string; role: string }>(
      'SELECT id, username, name, role FROM users WHERE id = ?',
      [Number(userId)],
    );

    if (!user) fail(401, '用户不存在');

    const permissions = await this.permissionService.getEffectivePermissions(user);
    if (!permissions.includes(permission)) fail(403, '无权限执行该操作');

    return true;
  }
}
