import { Table, TableForeignKey } from 'typeorm';
import { AddCourseCategories1788220800000 } from '../src/database/migrations/1788220800000-add-course-categories';
import { NormalizeCourseCategoryUuid1788393600000 } from '../src/database/migrations/1788393600000-normalize-course-category-uuid';
import { NormalizeCourseCategoryCreatedAtPrecision1788566400000 } from '../src/database/migrations/1788566400000-normalize-course-category-created-at-precision';

function queryRunner(overrides: Record<string, jest.Mock> = {}) {
  return {
    createTable: jest.fn().mockResolvedValue(undefined),
    hasColumn: jest.fn().mockResolvedValue(false),
    query: jest.fn().mockResolvedValue([]),
    getTable: jest.fn().mockResolvedValue({ foreignKeys: [] }),
    createForeignKey: jest.fn().mockResolvedValue(undefined),
    dropForeignKey: jest.fn().mockResolvedValue(undefined),
    dropColumn: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AddCourseCategories migration', () => {
  it('creates category table and nullable foreign key while keeping category as snapshot', async () => {
    const runner = queryRunner();

    await new AddCourseCategories1788220800000().up(runner as never);

    expect(runner.createTable).toHaveBeenCalledWith(expect.objectContaining({
      name: 'course_categories',
    }) as Table, true);
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `courses` ADD COLUMN `category_id` VARCHAR(36) NULL',
    );
    expect(runner.createForeignKey).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'fk_courses_category',
        columnNames: ['category_id'],
        referencedTableName: 'course_categories',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }) as TableForeignKey,
    );
  });
});

describe('NormalizeCourseCategoryUuid migration', () => {
  it('converts legacy integer category ids to uuid varchar ids', async () => {
    const runner = queryRunner({
      getTable: jest.fn()
        .mockResolvedValueOnce({
          columns: [{ name: 'id', type: 'int', isGenerated: true }],
          foreignKeys: [],
        })
        .mockResolvedValueOnce({
          columns: [{ name: 'category_id', type: 'int' }],
          foreignKeys: [{ name: 'fk_courses_category', columnNames: ['category_id'] }],
        })
        .mockResolvedValueOnce({
          columns: [{ name: 'category_id', type: 'int' }],
          foreignKeys: [{ name: 'fk_courses_category', columnNames: ['category_id'] }],
        })
        .mockResolvedValueOnce({
          columns: [{ name: 'category_id', type: 'varchar', length: '36' }],
          foreignKeys: [],
        }),
    });

    await new NormalizeCourseCategoryUuid1788393600000().up(runner as never);

    expect(runner.dropForeignKey).toHaveBeenCalledWith(
      'courses',
      expect.objectContaining({ name: 'fk_courses_category' }),
    );
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `course_categories` ADD COLUMN `uuid_id` VARCHAR(36) NULL',
    );
    expect(runner.query).toHaveBeenCalledWith(
      'UPDATE `course_categories` SET `uuid_id` = UUID() WHERE `uuid_id` IS NULL',
    );
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `course_categories` CHANGE `uuid_id` `id` VARCHAR(36) NOT NULL',
    );
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `course_categories` MODIFY `id` INT NOT NULL',
    );
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `courses` CHANGE `category_id_uuid` `category_id` VARCHAR(36) NULL',
    );
    expect(runner.createForeignKey).toHaveBeenCalledWith(
      'courses',
      expect.objectContaining({
        name: 'fk_courses_category',
        columnNames: ['category_id'],
        referencedTableName: 'course_categories',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }) as TableForeignKey,
    );
  });

  it('handles existing category table before courses.category_id exists', async () => {
    const runner = queryRunner({
      getTable: jest.fn()
        .mockResolvedValueOnce({
          columns: [{ name: 'id', type: 'int', isGenerated: true }],
          foreignKeys: [],
        })
        .mockResolvedValueOnce({
          columns: [],
          foreignKeys: [],
        })
        .mockResolvedValueOnce({
          columns: [],
          foreignKeys: [],
        })
        .mockResolvedValueOnce({
          columns: [{ name: 'category_id', type: 'varchar', length: '36' }],
          foreignKeys: [],
        }),
    });

    await new NormalizeCourseCategoryUuid1788393600000().up(runner as never);

    const sqlCalls = runner.query.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.some((sql) => sql.includes('CAST(c.category_id AS CHAR)'))).toBe(false);
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `courses` CHANGE `category_id_uuid` `category_id` VARCHAR(36) NULL',
    );
    expect(runner.createForeignKey).toHaveBeenCalledWith(
      'courses',
      expect.objectContaining({
        name: 'fk_courses_category',
        columnNames: ['category_id'],
      }) as TableForeignKey,
    );
  });
});

describe('NormalizeCourseCategoryCreatedAtPrecision migration', () => {
  it('upgrades existing created_at to microsecond precision', async () => {
    const runner = queryRunner({ hasColumn: jest.fn().mockResolvedValue(true) });

    await new NormalizeCourseCategoryCreatedAtPrecision1788566400000().up(runner as never);

    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `course_categories` MODIFY COLUMN `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
    );
  });
});
