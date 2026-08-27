import './load-env.mjs';
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const sqlitePath = resolve(process.env.SQLITE_DB_PATH || '../server/data/homework.db');
if (!existsSync(sqlitePath)) {
  throw new Error(`SQLite database does not exist: ${sqlitePath}`);
}

const mysqlConfig = readMysqlConfig();
await ensureDatabaseExists(mysqlConfig);
const mysqlConnection = await mysql.createConnection({
  host: mysqlConfig.host,
  port: mysqlConfig.port,
  user: mysqlConfig.user,
  password: mysqlConfig.password,
  database: mysqlConfig.database,
  charset: 'utf8mb4',
});
const sqlite = new Database(sqlitePath, { readonly: true });

try {
  await createMysqlTables(mysqlConnection);
  await mysqlConnection.query('SET FOREIGN_KEY_CHECKS = 0');
  await clearTargetTables(mysqlConnection);

  await copyTable(sqlite, mysqlConnection, 'users', ['id', 'username', 'password', 'name', 'role', 'avatar', 'created_at']);
  await copyTable(sqlite, mysqlConnection, 'courses', [
    'id',
    'name',
    'description',
    'instructor',
    'cover',
    'category',
    'status',
    'student_count',
    'lesson_count',
    'created_at',
    'updated_at',
  ]);
  await copyTable(sqlite, mysqlConnection, 'students', [
    'id',
    'name',
    'student_no',
    'class_name',
    'phone',
    'email',
    'status',
    'course_ids',
    'created_at',
    'updated_at',
  ]);
  await copyTable(sqlite, mysqlConnection, 'learning_records', ['id', 'student_id', 'course_id', 'date', 'duration']);
  await copyTable(sqlite, mysqlConnection, 'learning_summaries', [
    'id',
    'user_id',
    'title',
    'content',
    'created_at',
    'updated_at',
  ]);
  await copyTable(sqlite, mysqlConnection, 'roles', [
    'code',
    'name',
    'description',
    'editable',
    'builtin',
    'deletable',
    'updated_at',
    'created_at',
  ]);
  await copyTable(sqlite, mysqlConnection, 'permissions', ['code', 'name', 'module', 'module_name', 'sort_order']);
  await copyRolePermissions(sqlite, mysqlConnection);

  await resetAutoIncrement(mysqlConnection, 'users');
  await resetAutoIncrement(mysqlConnection, 'courses');
  await resetAutoIncrement(mysqlConnection, 'students');
  await resetAutoIncrement(mysqlConnection, 'learning_records');
  await resetAutoIncrement(mysqlConnection, 'learning_summaries');

  await mysqlConnection.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log(`SQLite -> MySQL migration finished: ${sqlitePath} -> ${mysqlConfig.database}`);
} catch (error) {
  await mysqlConnection.query('SET FOREIGN_KEY_CHECKS = 1');
  throw error;
} finally {
  sqlite.close();
  await mysqlConnection.end();
}

async function ensureDatabaseExists(config) {
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

async function createMysqlTables(connection) {
  for (const statement of getMysqlSchema()) {
    await connection.query(statement);
  }
}

async function clearTargetTables(connection) {
  const tables = [
    'role_permissions',
    'learning_summaries',
    'learning_records',
    'students',
    'courses',
    'users',
    'permissions',
    'roles',
  ];
  for (const table of tables) {
    await connection.query(`DELETE FROM \`${table}\``);
  }
}

// 作用：按原主键逐行复制普通业务表，源库缺少的兼容字段使用默认值补齐。
async function copyTable(sqliteDb, connection, table, targetColumns) {
  if (!sqliteTableExists(sqliteDb, table)) return;
  const sourceColumns = sqliteColumns(sqliteDb, table);
  const sourceRows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
  if (!sourceRows.length) return;

  const columns = targetColumns.filter((column) => sourceColumns.includes(column));
  const sql = `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  for (const row of sourceRows) {
    await connection.execute(sql, columns.map((column) => normalizeValue(table, column, row[column])));
  }
  console.log(`Copied ${sourceRows.length} rows: ${table}`);
}

// 作用：兼容新旧两种 role_permissions 结构，旧 role_id/permission_id 会转换为 role_code/permission_code。
async function copyRolePermissions(sqliteDb, connection) {
  if (!sqliteTableExists(sqliteDb, 'role_permissions')) return;
  const columns = sqliteColumns(sqliteDb, 'role_permissions');
  let rows = [];
  if (columns.includes('role_code') && columns.includes('permission_code')) {
    rows = sqliteDb.prepare('SELECT role_code, permission_code, created_at FROM role_permissions').all();
  } else if (columns.includes('role_id') && columns.includes('permission_id')) {
    rows = sqliteDb.prepare(`
      SELECT roles.code AS role_code, permissions.code AS permission_code, role_permissions.created_at
      FROM role_permissions
      JOIN roles ON roles.id = role_permissions.role_id
      JOIN permissions ON permissions.id = role_permissions.permission_id
      WHERE roles.code IS NOT NULL AND permissions.code IS NOT NULL
    `).all();
  }

  for (const row of rows) {
    await connection.execute(
      `
        INSERT IGNORE INTO role_permissions (role_code, permission_code, created_at)
        VALUES (?, ?, ?)
      `,
      [row.role_code, row.permission_code, row.created_at ?? null],
    );
  }
  console.log(`Copied ${rows.length} rows: role_permissions`);
}

async function resetAutoIncrement(connection, table) {
  const [rows] = await connection.query(`SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM \`${table}\``);
  await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${Number(rows[0].nextId)}`);
}

function sqliteTableExists(sqliteDb, table) {
  return Boolean(sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function sqliteColumns(sqliteDb, table) {
  return sqliteDb.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

function normalizeValue(table, column, value) {
  if (value === undefined) return null;
  if (['created_at', 'updated_at'].includes(column) && value === '') return null;
  if (table === 'students' && column === 'course_ids' && !value) return '[]';
  return value;
}

function readMysqlConfig() {
  return {
    host: requiredEnv('MYSQL_HOST'),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: requiredEnv('MYSQL_USER'),
    password: process.env.MYSQL_PASSWORD ?? '',
    database: requiredEnv('MYSQL_DATABASE'),
  };
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Please create server-nest/.env from .env.example.`);
  return value;
}

function safeDatabaseName(database) {
  if (!/^[A-Za-z0-9_$]+$/.test(database)) {
    throw new Error('MYSQL_DATABASE can only contain letters, numbers, underscores and $.');
  }
  return database;
}

function getMysqlSchema() {
  return [
  `CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) DEFAULT 'admin',
    avatar VARCHAR(255) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS courses (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructor VARCHAR(100) DEFAULT '',
    cover VARCHAR(255) DEFAULT '',
    category VARCHAR(100) DEFAULT '',
    status VARCHAR(50) DEFAULT 'draft',
    student_count INT DEFAULT 0,
    lesson_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS students (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    student_no VARCHAR(50) NOT NULL UNIQUE,
    class_name VARCHAR(100) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    email VARCHAR(100) DEFAULT '',
    status VARCHAR(50) DEFAULT 'active',
    course_ids TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS learning_records (
    id INT NOT NULL AUTO_INCREMENT,
    student_id INT,
    course_id INT,
    date VARCHAR(20) NOT NULL,
    duration INT DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_learning_records_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_learning_records_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS learning_summaries (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_learning_summaries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS roles (
    code VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    editable TINYINT(1) NOT NULL DEFAULT 1,
    builtin TINYINT(1) NOT NULL DEFAULT 0,
    deletable TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS permissions (
    code VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_code VARCHAR(100) NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_code, permission_code),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_code) REFERENCES roles(code) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
}
