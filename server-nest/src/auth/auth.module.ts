// 文件作用：认证模块，注册 AuthService、JWT 守卫和权限服务依赖。
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { JwtAuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  // 作用：聚合登录、JWT 守卫和权限守卫，向其他业务模块导出可复用的鉴权能力。
  imports: [DatabaseModule, PermissionsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
