import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateRefreshTokens1788652800000 implements MigrationInterface {
  name = 'CreateRefreshTokens1788652800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'refresh_tokens',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'user_id', type: 'int', isNullable: false },
        { name: 'family_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'token_hash', type: 'char', length: '64', isUnique: true, isNullable: false },
        { name: 'status', type: 'varchar', length: '16', default: "'active'", isNullable: false },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
        { name: 'last_used_at', type: 'datetime', isNullable: true },
        { name: 'idle_expires_at', type: 'datetime', isNullable: false },
        { name: 'absolute_expires_at', type: 'datetime', isNullable: false },
        { name: 'rotated_at', type: 'datetime', isNullable: true },
        { name: 'revoked_at', type: 'datetime', isNullable: true },
        { name: 'replaced_by_id', type: 'varchar', length: '36', isNullable: true },
      ],
    }), true);
    const table = await queryRunner.getTable('refresh_tokens');
    if (!table) return;
    if (!table.foreignKeys.some((key) => key.name === 'fk_refresh_tokens_user')) {
      await queryRunner.createForeignKey(table, new TableForeignKey({
        name: 'fk_refresh_tokens_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }));
    }
    await queryRunner.createIndex('refresh_tokens', new TableIndex({ name: 'idx_refresh_tokens_user_status', columnNames: ['user_id', 'status'] }));
    await queryRunner.createIndex('refresh_tokens', new TableIndex({ name: 'idx_refresh_tokens_family_status', columnNames: ['family_id', 'status'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refresh_tokens', true, true, true);
  }
}
