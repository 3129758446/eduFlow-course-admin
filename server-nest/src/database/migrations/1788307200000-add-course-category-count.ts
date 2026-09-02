import { MigrationInterface, QueryRunner } from 'typeorm';

// 文件作用：为已存在的课程分类表补充分类课程数字段，并按 courses.category_id 回填。
export class AddCourseCategoryCount1788307200000 implements MigrationInterface {
  name = 'AddCourseCategoryCount1788307200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('course_categories', 'course_count'))) {
      await queryRunner.query("ALTER TABLE `course_categories` ADD COLUMN `course_count` INT NOT NULL DEFAULT 0");
    }

    await queryRunner.query(`
      UPDATE course_categories cc
      SET cc.course_count = (
        SELECT COUNT(*)
        FROM courses c
        WHERE c.category_id = cc.id
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('course_categories', 'course_count')) {
      await queryRunner.dropColumn('course_categories', 'course_count');
    }
  }
}
