// 文件作用：工作台模块，装配 DashboardService 和接口控制器。
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  // 作用：工作台模块，聚合课程、学员和学习记录统计数据。
  imports: [DatabaseModule, PermissionsModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
