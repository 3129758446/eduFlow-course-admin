import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// 文件作用：新增课程分类字典表，并为 courses.category_id 建立可置空外键。
export class AddCourseCategories1788220800000 implements MigrationInterface {
  name = 'AddCourseCategories1788220800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'course_categories',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'name', type: 'varchar', length: '100', isUnique: true, isNullable: false },
        { name: 'course_count', type: 'int', default: 0, isNullable: false },
        // 与实体保持 DATETIME(6)，保证同秒新增的分类仍能稳定按新增顺序排序。
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
      ],
    }), true);

    await queryRunner.query(`
      INSERT INTO course_categories (id, name)
      SELECT UUID(), category_name
      FROM (
        SELECT DISTINCT TRIM(category) AS category_name
        FROM courses
        WHERE category IS NOT NULL AND TRIM(category) != ''
      ) distinct_categories
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);

    if (!(await queryRunner.hasColumn('courses', 'category_id'))) {
      await queryRunner.query('ALTER TABLE `courses` ADD COLUMN `category_id` VARCHAR(36) NULL');
    }

    await queryRunner.query(`
      UPDATE course_categories cc
      SET cc.course_count = (
        SELECT COUNT(*)
        FROM courses c
        WHERE c.category_id = cc.id
      )
    `);

    await queryRunner.query(`
      UPDATE courses c
      INNER JOIN course_categories cc ON cc.name = TRIM(c.category)
      SET c.category_id = cc.id
      WHERE c.category IS NOT NULL AND TRIM(c.category) != ''
    `);

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

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('courses');
    const foreignKey = table?.foreignKeys.find((key) => key.name === 'fk_courses_category');
    if (table && foreignKey) {
      await queryRunner.dropForeignKey(table, foreignKey);
    }
    if (await queryRunner.hasColumn('courses', 'category_id')) {
      await queryRunner.dropColumn('courses', 'category_id');
    }
    await queryRunner.dropTable('course_categories', true, true, true);
  }

  private async createForeignKeyIfMissing(queryRunner: QueryRunner) {
    const table = await queryRunner.getTable('courses');
    if (!table || table.foreignKeys.some((key) => key.name === 'fk_courses_category')) return;

    await queryRunner.createForeignKey(table, new TableForeignKey({
      name: 'fk_courses_category',
      columnNames: ['category_id'],
      referencedTableName: 'course_categories',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    }));
  }
}
