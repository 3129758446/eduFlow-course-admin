import '../config/load-env';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import mysql from 'mysql2/promise';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DATABASE_ENTITIES } from './entities';
import { CreateInitialTables1788134400000 } from './migrations/1788134400000-create-initial-tables';
import { AddCourseCategories1788220800000 } from './migrations/1788220800000-add-course-categories';
import { AddCourseCategoryCount1788307200000 } from './migrations/1788307200000-add-course-category-count';
import { NormalizeCourseCategoryUuid1788393600000 } from './migrations/1788393600000-normalize-course-category-uuid';
import { NormalizeCourseCategoryCreatedAtPrecision1788566400000 } from './migrations/1788566400000-normalize-course-category-created-at-precision';
import { CreateRefreshTokens1788652800000 } from './migrations/1788652800000-create-refresh-tokens';

// 文件作用：集中生成 TypeORM 和 MySQL 连接配置，并在连接前确保目标数据库存在。
export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

// 作用：读取 MySQL 环境变量，避免数据库连接参数散落在多个模块中。
export function readMysqlConfig(): MysqlConfig {
  return {
    host: requiredEnv('MYSQL_HOST'),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: requiredEnv('MYSQL_USER'),
    password: process.env.MYSQL_PASSWORD ?? '',
    database: requiredEnv('MYSQL_DATABASE'),
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  };
}

// 作用：提供 Nest TypeOrmModule 使用的运行时配置，关闭 synchronize，统一通过 migration 管理表结构。
export function createTypeOrmOptions(): TypeOrmModuleOptions {
  const config = readMysqlConfig();
  return {
    type: 'mysql',
    host: config.host,
    port: config.port,
    username: config.user,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    entities: DATABASE_ENTITIES,
    migrations: [
      CreateInitialTables1788134400000,
      AddCourseCategories1788220800000,
      AddCourseCategoryCount1788307200000,
      NormalizeCourseCategoryUuid1788393600000,
      NormalizeCourseCategoryCreatedAtPrecision1788566400000,
      CreateRefreshTokens1788652800000,
    ],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: shouldRunMigrations(),
    extra: {
      connectionLimit: config.connectionLimit,
    },
  };
}

// 作用：控制应用启动时是否自动执行 migration；生产环境默认关闭，可通过环境变量显式开启。
function shouldRunMigrations() {
  const value = process.env.TYPEORM_MIGRATIONS_RUN?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

// 作用：Nest 启动 TypeORM 前先创建数据库，再初始化 DataSource。
export async function initializeTypeOrmDataSource(options?: DataSourceOptions): Promise<DataSource> {
  if (!options) throw new Error('TypeORM DataSource 初始化缺少数据库配置');
  const config = readMysqlConfig();
  await ensureMysqlDatabase(config);
  return new DataSource(options).initialize();
}

// 作用：首次连接前创建 MySQL 数据库，减少新环境手动建库步骤。
async function ensureMysqlDatabase(config: MysqlConfig) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${safeDatabaseName(config.database)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

// 作用：校验必填环境变量，缺失时给出明确配置错误。
function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 MySQL 环境变量 ${name}，请根据 server-nest/.env.example 配置 .env`);
  return value;
}

// 作用：限制数据库名字符集，避免拼接 CREATE DATABASE 语句时出现注入风险。
function safeDatabaseName(database: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(database)) {
    throw new Error('MYSQL_DATABASE 只能包含字母、数字、下划线和 $');
  }
  return database;
}
