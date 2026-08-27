// 文件作用：上传模块，装配 UploadService 和接口控制器。
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  // 作用：上传模块，处理学习总结图片上传并复用权限保护。
  imports: [DatabaseModule, PermissionsModule, AuthModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
