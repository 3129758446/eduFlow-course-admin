// 文件作用：应用根模块，集中装配数据库、鉴权、权限、课程、学员、总结、系统管理、上传和静态资源模块。
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { CourseCategoriesModule } from './course-categories/course-categories.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { PermissionsModule } from './permissions/permissions.module';
import { StaticModule } from './static/static.module';
import { StudentsModule } from './students/students.module';
import { SummaryModule } from './summary/summary.module';
import { SystemModule } from './system/system.module';
import { UploadModule } from './upload/upload.module';

@Module({
  // AppModule 只负责装配功能模块，具体业务分别落在 controller/service 中，符合标准 NestJS 分层。
  imports: [
    DatabaseModule,
    PermissionsModule,
    AuthModule,
    DashboardModule,
    CourseCategoriesModule,
    CoursesModule,
    StudentsModule,
    SummaryModule,
    SystemModule,
    UploadModule,
    StaticModule,
  ],
  providers: [
    {
      // 全局异常过滤器把 NestJS 异常统一转换成旧 Koa 约定的 { code, msg, data }。
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
