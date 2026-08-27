// 文件作用：课程模块，装配 CoursesService 和接口控制器。
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  // 作用：课程管理模块，复用数据库、JWT 鉴权和权限码鉴权能力。
  imports: [DatabaseModule, PermissionsModule, AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
