import { createTypeOrmOptions } from '../src/database/typeorm.config';

describe('TypeORM config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MYSQL_HOST: '127.0.0.1',
      MYSQL_USER: 'root',
      MYSQL_DATABASE: 'eduflow_test',
    };
    delete process.env.TYPEORM_MIGRATIONS_RUN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not auto-run migrations in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';

    expect(createTypeOrmOptions().migrationsRun).toBe(false);

    process.env.TYPEORM_MIGRATIONS_RUN = 'true';
    expect(createTypeOrmOptions().migrationsRun).toBe(true);
  });
});
