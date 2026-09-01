import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// 文件作用：定义项目首次启动所需的完整数据库表结构。
// 说明：TypeORM 依赖类名末尾的 13 位时间戳来排序 migration，文件名和类名需要保持一致。
export class CreateInitialTables1788134400000 implements MigrationInterface {
  name = 'CreateInitialTables1788134400000';

  // 作用：创建业务表、系统权限表和必要外键；已有表时跳过，兼容已有数据库。
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'users',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'username', type: 'varchar', length: '100', isUnique: true, isNullable: false },
        { name: 'password', type: 'varchar', length: '255', isNullable: false },
        { name: 'name', type: 'varchar', length: '100', isNullable: false },
        { name: 'role', type: 'varchar', length: '100', default: "'admin'", isNullable: true },
        { name: 'avatar', type: 'varchar', length: '255', default: "''", isNullable: true },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'courses',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'name', type: 'varchar', length: '255', isNullable: false },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'instructor', type: 'varchar', length: '100', default: "''", isNullable: true },
        { name: 'cover', type: 'varchar', length: '255', default: "''", isNullable: true },
        { name: 'category', type: 'varchar', length: '100', default: "''", isNullable: true },
        { name: 'status', type: 'varchar', length: '50', default: "'draft'", isNullable: true },
        { name: 'student_count', type: 'int', default: 0, isNullable: true },
        { name: 'lesson_count', type: 'int', default: 0, isNullable: true },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'students',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'name', type: 'varchar', length: '100', isNullable: false },
        { name: 'student_no', type: 'varchar', length: '50', isUnique: true, isNullable: false },
        { name: 'class_name', type: 'varchar', length: '100', default: "''", isNullable: true },
        { name: 'phone', type: 'varchar', length: '50', default: "''", isNullable: true },
        { name: 'email', type: 'varchar', length: '100', default: "''", isNullable: true },
        { name: 'status', type: 'varchar', length: '50', default: "'active'", isNullable: true },
        { name: 'course_ids', type: 'text', isNullable: false },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'learning_records',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'student_id', type: 'int', isNullable: true },
        { name: 'course_id', type: 'int', isNullable: true },
        { name: 'date', type: 'varchar', length: '20', isNullable: false },
        { name: 'duration', type: 'int', default: 0, isNullable: true },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'learning_summaries',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'user_id', type: 'int', isNullable: false },
        { name: 'title', type: 'varchar', length: '255', isNullable: false },
        { name: 'content', type: 'text', isNullable: true },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'roles',
      columns: [
        { name: 'code', type: 'varchar', length: '100', isPrimary: true, isNullable: false },
        { name: 'name', type: 'varchar', length: '100', isNullable: false },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'editable', type: 'tinyint', width: 1, default: 1, isNullable: false },
        { name: 'builtin', type: 'tinyint', width: 1, default: 0, isNullable: false },
        { name: 'deletable', type: 'tinyint', width: 1, default: 1, isNullable: false },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
      ],
    }), true);

    // 作用：兼容早期已创建但缺少权限管理字段的 roles 表。
    await this.ensureColumn(queryRunner, 'roles', 'editable', 'TINYINT(1) NOT NULL DEFAULT 1');
    await this.ensureColumn(queryRunner, 'roles', 'builtin', 'TINYINT(1) NOT NULL DEFAULT 0');
    await this.ensureColumn(queryRunner, 'roles', 'deletable', 'TINYINT(1) NOT NULL DEFAULT 1');
    await this.ensureColumn(queryRunner, 'roles', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    await queryRunner.createTable(new Table({
      name: 'permissions',
      columns: [
        { name: 'code', type: 'varchar', length: '100', isPrimary: true, isNullable: false },
        { name: 'name', type: 'varchar', length: '100', isNullable: false },
        { name: 'module', type: 'varchar', length: '100', isNullable: false },
        { name: 'module_name', type: 'varchar', length: '100', isNullable: false },
        { name: 'sort_order', type: 'int', default: 0, isNullable: true },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'role_permissions',
      columns: [
        { name: 'role_code', type: 'varchar', length: '100', isPrimary: true, isNullable: false },
        { name: 'permission_code', type: 'varchar', length: '100', isPrimary: true, isNullable: false },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
      ],
    }), true);

    // 作用：补充跨表约束，保证学习记录、学习总结和角色权限关系不会引用无效数据。
    await this.createForeignKeyIfMissing(queryRunner, 'learning_records', new TableForeignKey({
      name: 'fk_learning_records_student',
      columnNames: ['student_id'],
      referencedTableName: 'students',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }), { childColumn: 'student_id', parentTable: 'students', parentColumn: 'id' });
    await this.createForeignKeyIfMissing(queryRunner, 'learning_records', new TableForeignKey({
      name: 'fk_learning_records_course',
      columnNames: ['course_id'],
      referencedTableName: 'courses',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }), { childColumn: 'course_id', parentTable: 'courses', parentColumn: 'id' });
    await this.createForeignKeyIfMissing(queryRunner, 'learning_summaries', new TableForeignKey({
      name: 'fk_learning_summaries_user',
      columnNames: ['user_id'],
      referencedTableName: 'users',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }), { childColumn: 'user_id', parentTable: 'users', parentColumn: 'id' });
    await this.createForeignKeyIfMissing(queryRunner, 'role_permissions', new TableForeignKey({
      name: 'fk_role_permissions_role',
      columnNames: ['role_code'],
      referencedTableName: 'roles',
      referencedColumnNames: ['code'],
      onDelete: 'CASCADE',
    }), { childColumn: 'role_code', parentTable: 'roles', parentColumn: 'code' });
    await this.createForeignKeyIfMissing(queryRunner, 'role_permissions', new TableForeignKey({
      name: 'fk_role_permissions_permission',
      columnNames: ['permission_code'],
      referencedTableName: 'permissions',
      referencedColumnNames: ['code'],
      onDelete: 'CASCADE',
    }), { childColumn: 'permission_code', parentTable: 'permissions', parentColumn: 'code' });
  }

  // 作用：回滚首次建表。注意：生产环境执行回滚会删除业务表及数据。
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('role_permissions', true, true, true);
    await queryRunner.dropTable('permissions', true, true, true);
    await queryRunner.dropTable('roles', true, true, true);
    await queryRunner.dropTable('learning_summaries', true, true, true);
    await queryRunner.dropTable('learning_records', true, true, true);
    await queryRunner.dropTable('students', true, true, true);
    await queryRunner.dropTable('courses', true, true, true);
    await queryRunner.dropTable('users', true, true, true);
  }

  // 作用：只在字段缺失时补列，避免重复 ALTER TABLE 导致启动失败。
  private async ensureColumn(queryRunner: QueryRunner, tableName: string, columnName: string, definition: string) {
    const hasColumn = await queryRunner.hasColumn(tableName, columnName);
    if (!hasColumn) await queryRunner.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }

  // 作用：只在外键不存在且旧库无脏引用时创建，避免已有数据阻断服务启动。
  private async createForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKey: TableForeignKey,
    orphanCheck: { childColumn: string; parentTable: string; parentColumn: string },
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table || table.foreignKeys.some((key) => key.name === foreignKey.name)) return;
    if (await this.hasOrphanReferences(queryRunner, tableName, orphanCheck)) return;
    await queryRunner.createForeignKey(table, foreignKey);
  }

  // 作用：检查外键列是否存在指向不存在父表记录的历史数据；存在时保留数据并跳过外键创建。
  private async hasOrphanReferences(
    queryRunner: QueryRunner,
    tableName: string,
    { childColumn, parentTable, parentColumn }: { childColumn: string; parentTable: string; parentColumn: string },
  ) {
    const rows = await queryRunner.query(
      `
        SELECT COUNT(*) AS count
        FROM \`${tableName}\` child_table
        LEFT JOIN \`${parentTable}\` parent_table
          ON child_table.\`${childColumn}\` = parent_table.\`${parentColumn}\`
        WHERE child_table.\`${childColumn}\` IS NOT NULL
          AND parent_table.\`${parentColumn}\` IS NULL
      `,
    ) as Array<{ count: number | string }>;
    return Number(rows[0]?.count ?? 0) > 0;
  }
}
