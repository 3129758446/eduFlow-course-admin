// 文件作用：系统管理模块，装配 SystemService、PermissionService 和接口控制器。
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  // 作用：系统管理模块，承载账号、角色和权限配置接口。
  imports: [DatabaseModule, PermissionsModule, AuthModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
