import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

// 文件作用：修复已执行过早期迁移的数据库，把课程分类主键统一为 UUID 字符串。
export class NormalizeCourseCategoryUuid1788393600000 implements MigrationInterface {
  name = 'NormalizeCourseCategoryUuid1788393600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const categoryTable = await queryRunner.getTable('course_categories');
    const courseTable = await queryRunner.getTable('courses');
    if (!categoryTable || !courseTable) return;

    await this.dropCategoryForeignKeys(queryRunner);

    const categoryIdColumn = categoryTable.columns.find((column) => column.name === 'id');
    const courseCategoryIdColumn = courseTable.columns.find((column) => column.name === 'category_id');
    const categoryIdIsUuid = categoryIdColumn?.type === 'varchar' && String(categoryIdColumn.length) === '36';
    const courseCategoryIdIsUuid = courseCategoryIdColumn?.type === 'varchar' && String(courseCategoryIdColumn.length) === '36';

    if (!categoryIdIsUuid) {
      if (!(await queryRunner.hasColumn('course_categories', 'uuid_id'))) {
        await queryRunner.query('ALTER TABLE `course_categories` ADD COLUMN `uuid_id` VARCHAR(36) NULL');
      }
      await queryRunner.query('UPDATE `course_categories` SET `uuid_id` = UUID() WHERE `uuid_id` IS NULL');
      await this.ensureCourseCategoryUuidColumn(queryRunner);

      if (courseCategoryIdColumn) {
        await queryRunner.query(`
          UPDATE courses c
          INNER JOIN course_categories cc ON CAST(c.category_id AS CHAR) = CAST(cc.id AS CHAR)
          SET c.category_id_uuid = cc.uuid_id
          WHERE c.category_id IS NOT NULL
        `);
      }
      await this.backfillCourseCategoryByName(queryRunner, 'category_id_uuid', 'uuid_id');

      if (courseCategoryIdColumn) {
        await queryRunner.query('ALTER TABLE `courses` DROP COLUMN `category_id`');
      }
      if (categoryIdColumn?.isGenerated) {
        await queryRunner.query(`ALTER TABLE \`course_categories\` MODIFY \`id\` ${this.columnTypeSql(categoryIdColumn)} NOT NULL`);
      }
      await queryRunner.query('ALTER TABLE `course_categories` DROP PRIMARY KEY');
      await queryRunner.query('ALTER TABLE `course_categories` DROP COLUMN `id`');
      await queryRunner.query('ALTER TABLE `course_categories` CHANGE `uuid_id` `id` VARCHAR(36) NOT NULL');
      await queryRunner.query('ALTER TABLE `course_categories` ADD PRIMARY KEY (`id`)');
      await queryRunner.query('ALTER TABLE `courses` CHANGE `category_id_uuid` `category_id` VARCHAR(36) NULL');
    } else if (!courseCategoryIdIsUuid) {
      await this.ensureCourseCategoryUuidColumn(queryRunner);
      if (courseCategoryIdColumn) {
        await queryRunner.query(`
          UPDATE courses c
          INNER JOIN course_categories cc ON CAST(c.category_id AS CHAR) = CAST(cc.id AS CHAR)
          SET c.category_id_uuid = cc.id
          WHERE c.category_id IS NOT NULL
        `);
        await queryRunner.query('ALTER TABLE `courses` DROP COLUMN `category_id`');
      }
      await this.backfillCourseCategoryByName(queryRunner, 'category_id_uuid', 'id');
      await queryRunner.query('ALTER TABLE `courses` CHANGE `category_id_uuid` `category_id` VARCHAR(36) NULL');
    }

    await queryRunner.query(`
      UPDATE course_categories cc
      SET cc.course_count = (
        SELECT COUNT(*)
        FROM courses c
        WHERE c.category_id = cc.id
      )
    `);
    await this.createForeignKeyIfMissing(queryRunner);
  }

  async down(): Promise<void> {
    // UUID 主键迁移不可逆：回滚会破坏 courses.category_id 与 course_categories.id 的映射。
  }

  private async ensureCourseCategoryUuidColumn(queryRunner: QueryRunner) {
    if (!(await queryRunner.hasColumn('courses', 'category_id_uuid'))) {
      await queryRunner.query('ALTER TABLE `courses` ADD COLUMN `category_id_uuid` VARCHAR(36) NULL');
    }
  }

  private columnTypeSql(column: { type?: string; length?: string }) {
    const type = String(column.type || 'int').toUpperCase();
    return column.length ? `${type}(${column.length})` : type;
  }

  private async backfillCourseCategoryByName(queryRunner: QueryRunner, targetColumn: string, sourceIdColumn: string) {
    await queryRunner.query(`
      UPDATE courses c
      INNER JOIN course_categories cc ON cc.name = TRIM(c.category)
      SET c.${targetColumn} = cc.${sourceIdColumn}
      WHERE c.${targetColumn} IS NULL
        AND c.category IS NOT NULL
        AND TRIM(c.category) != ''
    `);
  }

  private async dropCategoryForeignKeys(queryRunner: QueryRunner) {
    const table = await queryRunner.getTable('courses');
    const foreignKeys = table?.foreignKeys.filter((key) => key.columnNames.includes('category_id')) ?? [];
    for (const foreignKey of foreignKeys) {
      await queryRunner.dropForeignKey('courses', foreignKey);
    }
  }

  private async createForeignKeyIfMissing(queryRunner: QueryRunner) {
    const table = await queryRunner.getTable('courses');
    if (!table || table.foreignKeys.some((key) => key.name === 'fk_courses_category')) return;

    await queryRunner.createForeignKey('courses', new TableForeignKey({
      name: 'fk_courses_category',
      columnNames: ['category_id'],
      referencedTableName: 'course_categories',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    }));
  }
}
