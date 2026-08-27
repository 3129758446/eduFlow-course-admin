// 文件作用：学员模块，装配 StudentsService 和接口控制器。
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  // 作用：学员管理模块，负责学员 CRUD、选课关系和权限保护。
  imports: [DatabaseModule, PermissionsModule, AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
