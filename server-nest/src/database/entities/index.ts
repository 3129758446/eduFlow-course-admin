import { CourseEntity } from './course.entity';
import { LearningRecordEntity } from './learning-record.entity';
import { LearningSummaryEntity } from './learning-summary.entity';
import { PermissionEntity } from './permission.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { RoleEntity } from './role.entity';
import { StudentEntity } from './student.entity';
import { UserEntity } from './user.entity';

// 文件作用：统一导出数据库实体，并提供 TypeOrmModule.forFeature/forRoot 使用的实体列表。
export const DATABASE_ENTITIES = [
  UserEntity,
  CourseEntity,
  StudentEntity,
  LearningRecordEntity,
  LearningSummaryEntity,
  RoleEntity,
  PermissionEntity,
  RolePermissionEntity,
];

export {
  CourseEntity,
  LearningRecordEntity,
  LearningSummaryEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  StudentEntity,
  UserEntity,
};
