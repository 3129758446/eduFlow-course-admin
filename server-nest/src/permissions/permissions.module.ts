// 文件作用：权限模块，导出 PermissionService 供鉴权和系统管理模块复用。
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PermissionService } from './permission.service';

@Module({
  // 作用：权限模块，集中维护 RBAC 权限字典、角色权限映射和权限计算逻辑。
  imports: [DatabaseModule],
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionsModule {}
