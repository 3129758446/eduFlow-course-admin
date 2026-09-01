import { TableForeignKey } from 'typeorm';
import { CreateInitialTables1788134400000 } from '../src/database/migrations/1788134400000-create-initial-tables';

function queryRunner(overrides: Record<string, jest.Mock> = {}) {
  return {
    createTable: jest.fn().mockResolvedValue(undefined),
    hasColumn: jest.fn().mockResolvedValue(true),
    query: jest.fn().mockResolvedValue([{ count: 0 }]),
    getTable: jest.fn().mockResolvedValue({ foreignKeys: [] }),
    createForeignKey: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('CreateInitialTables migration', () => {
  it('skips foreign key creation when an existing table contains orphan references', async () => {
    const runner = queryRunner({
      query: jest.fn().mockResolvedValue([{ count: 1 }]),
    });

    await new CreateInitialTables1788134400000().up(runner as never);

    expect(runner.createForeignKey).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.any(TableForeignKey),
    );
  });
});
