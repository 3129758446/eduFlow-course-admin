import { MigrationInterface, QueryRunner } from 'typeorm';

// 文件作用：修正早期已执行迁移产生的 created_at 秒级精度，保证分类按新增顺序稳定排序。
export class NormalizeCourseCategoryCreatedAtPrecision1788566400000 implements MigrationInterface {
  name = 'NormalizeCourseCategoryCreatedAtPrecision1788566400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('course_categories', 'created_at')) {
      // 兼容已执行过早期秒级 created_at 迁移的数据库，升级为微秒精度。
      await queryRunner.query('ALTER TABLE `course_categories` MODIFY COLUMN `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
      return;
    }
    await queryRunner.query('ALTER TABLE `course_categories` ADD COLUMN `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('course_categories', 'created_at')) {
      await queryRunner.query('ALTER TABLE `course_categories` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }
  }
}
