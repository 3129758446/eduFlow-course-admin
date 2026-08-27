// 文件作用：封装 mysql2/promise 连接池、MySQL 建库建表、初始化数据和通用 SQL 访问方法。
import '../config/load-env';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
} from '../permissions/permissions.constants';

type QueryParam = string | number | boolean | null | Date;
type QueryExecutor = Pool | PoolConnection;

interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly config: MysqlConfig;
  private pool?: Pool;

  // 作用：读取 MySQL 连接配置；实际建库和建表放到 onModuleInit，避免构造阶段执行异步副作用。

  constructor() {
    this.config = readMysqlConfig();
  }

  // 作用：Nest 模块启动时创建数据库、连接池、表结构，并补齐权限字典和演示数据。

  async onModuleInit() {
    await this.ensureDatabaseExists();
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      connectionLimit: this.config.connectionLimit,
      charset: 'utf8mb4',
      waitForConnections: true,
      namedPlaceholders: false,
    });
    await this.initDatabase();
  }

  // 作用：应用关闭时释放 MySQL 连接池，避免开发热重载时残留连接。

  async onModuleDestroy() {
    await this.pool?.end();
  }

  // 作用：执行 SELECT 并返回全部行，业务层通过它保持和旧 all() 调用相同的语义。

  async all<T = RowDataPacket>(sql: string, params: QueryParam[] = [], executor?: QueryExecutor): Promise<T[]> {
    const [rows] = await this.executor(executor).execute<RowDataPacket[]>(sql, params);
    return rows as T[];
  }

  // 作用：执行 SELECT 并返回第一行，业务层通过它保持和旧 get() 调用相同的语义。

  async get<T = RowDataPacket>(sql: string, params: QueryParam[] = [], executor?: QueryExecutor): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params, executor);
    return rows[0];
  }

  // 作用：执行 INSERT/UPDATE/DELETE，统一返回 mysql2 的 ResultSetHeader。

  async run(sql: string, params: QueryParam[] = [], executor?: QueryExecutor): Promise<ResultSetHeader> {
    const [result] = await this.executor(executor).execute<ResultSetHeader>(sql, params);
    return result;
  }

  // 作用：封装 MySQL 事务，确保角色权限替换、学员选课统计等多步写入要么全部成功要么回滚。

  async transaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.requirePool().getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 作用：初始化完整 MySQL 表结构，字段含义保持和原 SQLite/Koa 版本一致。

  private async initDatabase() {
    await this.createTables();
    await this.ensurePermissionColumns();
    await this.seedPermissionData();
    await this.seedData();
    await this.refreshLearningRecords();
  }

  // 作用：启动时自动创建目标数据库，减少本机 MySQL 首次启动前的手工步骤。

  private async ensureDatabaseExists() {
    const connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
    });
    try {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${safeDatabaseName(this.config.database)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } finally {
      await connection.end();
    }
  }

  // 作用：把 SQLite 建表语法转换为 MySQL 8.0 兼容写法，保留主键、自增、唯一约束和外键关系。

  private async createTables() {
    for (const statement of MYSQL_SCHEMA) {
      await this.run(statement);
    }
  }

  // 作用：兼容较早 Nest 迁移版本创建过的 roles 表，缺字段时补齐。

  private async ensurePermissionColumns() {
    await this.ensureColumn('roles', 'editable', 'TINYINT(1) NOT NULL DEFAULT 1');
    await this.ensureColumn('roles', 'builtin', 'TINYINT(1) NOT NULL DEFAULT 0');
    await this.ensureColumn('roles', 'deletable', 'TINYINT(1) NOT NULL DEFAULT 1');
    await this.ensureColumn('roles', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  }

  // 作用：查询 information_schema 后按需补列，避免重复 ALTER TABLE 导致启动失败。

  private async ensureColumn(tableName: string, columnName: string, definition: string) {
    const column = await this.get<{ COLUMN_NAME: string }>(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
      `,
      [this.config.database, tableName, columnName],
    );
    if (column) return;
    await this.run(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }

  // 作用：写入权限字典和内置角色，保证权限配置页始终有稳定数据源。

  private async seedPermissionData() {
    const roles = [
      { code: 'admin', name: '管理员', description: '拥有全部权限', editable: 0, builtin: 1, deletable: 0 },
      { code: 'teacher', name: '教师', description: '可维护课程、学生和学习总结', editable: 1, builtin: 1, deletable: 0 },
      { code: 'student', name: '学生', description: '可查看基础数据并维护学习总结', editable: 1, builtin: 1, deletable: 0 },
    ];
    for (const role of roles) {
      await this.run(
        `
          INSERT IGNORE INTO roles (code, name, description, editable, builtin, deletable)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [role.code, role.name, role.description, role.editable, role.builtin, role.deletable],
      );
    }
    await this.run('UPDATE roles SET editable = 0, builtin = 1, deletable = 0 WHERE code = ?', ['admin']);
    await this.run("UPDATE roles SET builtin = 1, deletable = 0 WHERE code IN ('teacher', 'student')");

    let sortOrder = 1;
    for (const group of PERMISSION_GROUPS) {
      for (const permission of group.permissions) {
        await this.run(
          `
            INSERT IGNORE INTO permissions (code, name, module, module_name, sort_order)
            VALUES (?, ?, ?, ?, ?)
          `,
          [permission.code, permission.name, group.module, group.moduleName, sortOrder],
        );
        sortOrder += 1;
      }
    }

    await this.seedDefaultRolePermissions('teacher', DEFAULT_ROLE_PERMISSIONS.teacher);
    await this.seedDefaultRolePermissions('student', DEFAULT_ROLE_PERMISSIONS.student);
  }

  // 作用：仅在角色没有任何权限配置时写入默认权限，避免覆盖管理员在页面上的手动调整。

  private async seedDefaultRolePermissions(roleCode: string, permissions: string[]) {
    const existing = await this.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM role_permissions WHERE role_code = ?',
      [roleCode],
    );
    if (Number(existing?.count ?? 0) > 0) return;

    for (const permission of permissions) {
      await this.run('INSERT IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)', [
        roleCode,
        permission,
      ]);
    }
  }

  // 作用：空库时写入演示课程和学员；已有数据时只补默认账号，不覆盖真实业务数据。

  private async seedData() {
    const userCount = await this.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    const shouldSeedBusinessData = Number(userCount?.count ?? 0) === 0;
    await this.ensureDemoUsers();
    if (!shouldSeedBusinessData) return;

    const courses = [
      ['React 基础入门', '从零开始学习 React 框架，掌握组件化开发思想', '张老师', '前端开发', 'published', 32, 12],
      ['Node.js 服务端开发', '学习 Node.js 构建高性能服务端应用', '李老师', '后端开发', 'published', 28, 10],
      ['Vue 3 实战项目', '通过实际项目掌握 Vue 3 Composition API', '王老师', '前端开发', 'published', 45, 15],
      ['TypeScript 高级编程', '深入理解 TypeScript 类型系统与高级特性', '赵老师', '前端开发', 'published', 20, 8],
      ['MySQL 数据库设计', '数据库设计规范与 SQL 优化实践', '孙老师', '数据库', 'published', 18, 9],
      ['Docker 容器化部署', '学习 Docker 容器技术与微服务部署', '周老师', '运维', 'draft', 0, 6],
      ['Python 数据分析', '使用 Python 进行数据清洗、分析与可视化', '吴老师', '数据科学', 'published', 35, 11],
      ['Git 版本控制', '掌握 Git 工作流与团队协作开发', '郑老师', '工具', 'published', 50, 7],
      ['Webpack 工程化实践', '深入学习 Webpack 配置与前端工程化体系', '张老师', '前端开发', 'published', 22, 9],
      ['Redis 缓存技术', '掌握 Redis 数据结构、持久化与分布式缓存方案', '李老师', '数据库', 'published', 15, 8],
      ['Linux 运维基础', '学习 Linux 常用命令、Shell 脚本与服务器管理', '周老师', '运维', 'draft', 0, 10],
      ['Jest 单元测试', '前端自动化测试框架 Jest 与 React Testing Library 实战', '赵老师', '前端开发', 'published', 12, 6],
      ['MongoDB 入门到实战', '学习 NoSQL 数据库 MongoDB 的 CRUD 与聚合操作', '孙老师', '数据库', 'published', 25, 10],
    ];
    for (const course of courses) {
      await this.run(
        `
          INSERT INTO courses (name, description, instructor, category, status, student_count, lesson_count)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        course,
      );
    }

    const classNames = ['前端2401班', '前端2402班', '后端2401班', '全栈2401班'];
    const studentNames = [
      '陈明远', '林小雪', '张伟杰', '刘思琪', '王大勇',
      '赵文静', '孙志强', '周小红', '吴建国', '郑美玲',
      '黄志勇', '许晓峰', '何雨萱', '胡正阳', '高明月',
      '马思远', '罗晓丹', '梁静怡', '谢建华', '宋雅琴',
    ];
    for (let i = 0; i < studentNames.length; i += 1) {
      const courseIds: number[] = [];
      while (courseIds.length < Math.floor(Math.random() * 3) + 1) {
        const id = Math.floor(Math.random() * 12) + 1;
        if (!courseIds.includes(id)) courseIds.push(id);
      }
      await this.run(
        `
          INSERT INTO students (name, student_no, class_name, phone, email, status, course_ids)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          studentNames[i],
          `2024${String(i + 1).padStart(4, '0')}`,
          classNames[i % classNames.length],
          `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
          `student${i + 1}@example.com`,
          i < 18 ? 'active' : 'inactive',
          JSON.stringify(courseIds),
        ],
      );
    }
  }

  // 作用：保证默认演示账号存在，并兼容早期默认密码约定。

  private async ensureDemoUsers() {
    const users = [
      { username: 'admin', password: 'admin123', name: '管理员', role: 'admin' },
      { username: 'teacher', password: '123456', name: '教师账号', role: 'teacher' },
      { username: 'student', password: '123456', name: '学生账号', role: 'student' },
    ];
    const viewerUser = await this.get<{ id: number }>('SELECT id FROM users WHERE username = ?', ['viewer']);
    const studentUser = await this.get<{ id: number }>('SELECT id FROM users WHERE username = ?', ['student']);
    if (viewerUser && !studentUser) {
      await this.run('UPDATE users SET username = ?, password = ?, name = ?, role = ? WHERE id = ?', [
        'student',
        bcrypt.hashSync('student123', 10),
        '学生账号',
        'student',
        viewerUser.id,
      ]);
    }

    for (const user of users) {
      await this.run(
        'INSERT IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
        [user.username, bcrypt.hashSync(user.password, 10), user.name, user.role],
      );
    }
    await this.migrateDefaultPassword('teacher', 'teacher123', '123456');
    await this.migrateDefaultPassword('student', 'student123', '123456');
  }

  // 作用：把旧演示密码迁移到当前约定密码，保证历史数据导入后仍能按新文档登录。

  private async migrateDefaultPassword(username: string, oldPassword: string, newPassword: string) {
    const user = await this.get<{ id: number; password: string }>(
      'SELECT id, password FROM users WHERE username = ?',
      [username],
    );
    if (user && bcrypt.compareSync(oldPassword, user.password)) {
      await this.run('UPDATE users SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), user.id]);
    }
  }

  // 作用：补齐近 7 天学习记录，供工作台趋势图展示。

  private async refreshLearningRecords() {
    const studentIds = (await this.all<{ id: number }>('SELECT id FROM students')).map((student) => student.id);
    const courseIds = (await this.all<{ id: number }>('SELECT id FROM courses')).map((course) => course.id);
    if (!studentIds.length || !courseIds.length) return;

    const today = new Date();
    for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      const existing = await this.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM learning_records WHERE date = ?',
        [dateStr],
      );
      if (Number(existing?.count ?? 0) > 0) continue;

      const recordCount = Math.floor(Math.random() * 10) + 5;
      for (let j = 0; j < recordCount; j += 1) {
        await this.run(
          'INSERT INTO learning_records (student_id, course_id, date, duration) VALUES (?, ?, ?, ?)',
          [
            studentIds[Math.floor(Math.random() * studentIds.length)],
            courseIds[Math.floor(Math.random() * courseIds.length)],
            dateStr,
            Math.floor(Math.random() * 90) + 10,
          ],
        );
      }
    }
  }

  private executor(executor?: QueryExecutor): QueryExecutor {
    return executor ?? this.requirePool();
  }

  private requirePool(): Pool {
    if (!this.pool) throw new Error('MySQL 连接池尚未初始化');
    return this.pool;
  }
}

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

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 MySQL 环境变量 ${name}，请根据 server-nest/.env.example 配置 .env`);
  return value;
}

function safeDatabaseName(database: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(database)) {
    throw new Error('MYSQL_DATABASE 只能包含字母、数字、下划线和 $');
  }
  return database;
}

export const MYSQL_SCHEMA = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(100) DEFAULT 'admin',
      avatar VARCHAR(255) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS courses (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS students (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS learning_records (
      id INT NOT NULL AUTO_INCREMENT,
      student_id INT,
      course_id INT,
      date VARCHAR(20) NOT NULL,
      duration INT DEFAULT 0,
      PRIMARY KEY (id),
      CONSTRAINT fk_learning_records_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      CONSTRAINT fk_learning_records_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS learning_summaries (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_learning_summaries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS roles (
      code VARCHAR(100) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      editable TINYINT(1) NOT NULL DEFAULT 1,
      builtin TINYINT(1) NOT NULL DEFAULT 0,
      deletable TINYINT(1) NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS permissions (
      code VARCHAR(100) NOT NULL,
      name VARCHAR(100) NOT NULL,
      module VARCHAR(100) NOT NULL,
      module_name VARCHAR(100) NOT NULL,
      sort_order INT DEFAULT 0,
      PRIMARY KEY (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_code VARCHAR(100) NOT NULL,
      permission_code VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_code, permission_code),
      CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_code) REFERENCES roles(code) ON DELETE CASCADE,
      CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
];
