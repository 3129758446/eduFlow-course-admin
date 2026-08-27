import './load-env.mjs';
import mysql from 'mysql2/promise';

const config = readMysqlConfig();
const tables = [
  'users',
  'courses',
  'students',
  'learning_records',
  'learning_summaries',
  'roles',
  'permissions',
  'role_permissions',
];
const connection = await mysql.createConnection({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
});

try {
  const result = {};
  for (const table of tables) {
    // 作用：只做只读计数校验，适合发布前快速确认 MySQL 表结构和连接配置可用。
    const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
    result[table] = Number(rows[0].count);
  }
  const [customRoleRows] = await connection.execute(
    "SELECT COUNT(*) as count FROM roles WHERE builtin = 0 OR code LIKE 'custom_%'",
  );
  console.log(JSON.stringify({
    mysql: maskPassword(config),
    tables: result,
    customRoles: Number(customRoleRows[0].count),
  }, null, 2));
} finally {
  await connection.end();
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

function maskPassword(config) {
  return { ...config, password: config.password ? '******' : '' };
}
