import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { CourseCategoriesController } from './course-categories.controller';
import { CourseCategoriesService } from './course-categories.service';

@Module({
  imports: [DatabaseModule, PermissionsModule, AuthModule],
  controllers: [CourseCategoriesController],
  providers: [CourseCategoriesService],
})
export class CourseCategoriesModule {}
