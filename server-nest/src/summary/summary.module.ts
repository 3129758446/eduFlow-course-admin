// 文件作用：学习总结模块，装配 SummaryService 和接口控制器。
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  // 作用：学习总结模块，负责按登录用户隔离总结数据。
  imports: [DatabaseModule, PermissionsModule, AuthModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
