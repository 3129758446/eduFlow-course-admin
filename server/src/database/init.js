/* 
模块：数据库初始化与 Mock
定位：创建表结构、种子数据与近 7 天学习记录；提供刷新学习记录的工具
要点：初始账户 admin/admin123；学生与课程存在多对多关系以 JSON 数组存 course_ids
*/
import db from './db.js';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
} from '../permissions.js';

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      instructor TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      category TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      student_count INTEGER DEFAULT 0,
      lesson_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      student_no TEXT UNIQUE NOT NULL,
      class_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      course_ids TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      course_id INTEGER,
      date TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      module TEXT DEFAULT '',
      module_name TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_migrations (
      key TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedRolesAndPermissions();
  seedData();
  refreshLearningRecords();
}

function refreshLearningRecords() {
  const studentIds = db.prepare('SELECT id FROM students').all().map((student) => student.id);
  const courseIds = db.prepare('SELECT id FROM courses').all().map((course) => course.id);

  if (!studentIds.length || !courseIds.length) return;

  const insertRecord = db.prepare(`
    INSERT INTO learning_records (student_id, course_id, date, duration)
    VALUES (@student_id, @course_id, @date, @duration)
  `);
  const countRecordsByDate = db.prepare(
    'SELECT COUNT(*) as count FROM learning_records WHERE date = ?'
  );

  const today = new Date();
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    if (countRecordsByDate.get(dateStr).count > 0) continue;

    const recordCount = Math.floor(Math.random() * 10) + 5;
    for (let j = 0; j < recordCount; j++) {
      insertRecord.run({
        student_id: studentIds[Math.floor(Math.random() * studentIds.length)],
        course_id: courseIds[Math.floor(Math.random() * courseIds.length)],
        date: dateStr,
        duration: Math.floor(Math.random() * 90) + 10,
      });
    }
  }
}

function seedData() {
  const shouldSeedBusinessData =
    db.prepare('SELECT COUNT(*) as count FROM users').get().count === 0;
  ensureDemoUsers();

  if (!shouldSeedBusinessData) return;

  const courses = [
    { name: 'React 基础入门', description: '从零开始学习 React 框架，掌握组件化开发思想', instructor: '张老师', category: '前端开发', status: 'published', student_count: 32, lesson_count: 12 },
    { name: 'Node.js 服务端开发', description: '学习 Node.js 构建高性能服务端应用', instructor: '李老师', category: '后端开发', status: 'published', student_count: 28, lesson_count: 10 },
    { name: 'Vue 3 实战项目', description: '通过实际项目掌握 Vue 3 Composition API', instructor: '王老师', category: '前端开发', status: 'published', student_count: 45, lesson_count: 15 },
    { name: 'TypeScript 高级编程', description: '深入理解 TypeScript 类型系统与高级特性', instructor: '赵老师', category: '前端开发', status: 'published', student_count: 20, lesson_count: 8 },
    { name: 'MySQL 数据库设计', description: '数据库设计规范与 SQL 优化实践', instructor: '孙老师', category: '数据库', status: 'published', student_count: 18, lesson_count: 9 },
    { name: 'Docker 容器化部署', description: '学习 Docker 容器技术与微服务部署', instructor: '周老师', category: '运维', status: 'draft', student_count: 0, lesson_count: 6 },
    { name: 'Python 数据分析', description: '使用 Python 进行数据清洗、分析与可视化', instructor: '吴老师', category: '数据科学', status: 'published', student_count: 35, lesson_count: 11 },
    { name: 'Git 版本控制', description: '掌握 Git 工作流与团队协作开发', instructor: '郑老师', category: '工具', status: 'published', student_count: 50, lesson_count: 7 },
    { name: 'Webpack 工程化实践', description: '深入学习 Webpack 配置与前端工程化体系', instructor: '张老师', category: '前端开发', status: 'published', student_count: 22, lesson_count: 9 },
    { name: 'Redis 缓存技术', description: '掌握 Redis 数据结构、持久化与分布式缓存方案', instructor: '李老师', category: '数据库', status: 'published', student_count: 15, lesson_count: 8 },
    { name: 'Linux 运维基础', description: '学习 Linux 常用命令、Shell 脚本与服务器管理', instructor: '周老师', category: '运维', status: 'draft', student_count: 0, lesson_count: 10 },
    { name: 'Jest 单元测试', description: '前端自动化测试框架 Jest 与 React Testing Library 实战', instructor: '赵老师', category: '前端开发', status: 'published', student_count: 12, lesson_count: 6 },
    { name: 'MongoDB 入门到实战', description: '学习 NoSQL 数据库 MongoDB 的 CRUD 与聚合操作', instructor: '孙老师', category: '数据库', status: 'published', student_count: 25, lesson_count: 10 },
  ];

  const insertCourse = db.prepare(`
    INSERT INTO courses (name, description, instructor, category, status, student_count, lesson_count)
    VALUES (@name, @description, @instructor, @category, @status, @student_count, @lesson_count)
  `);

  for (const course of courses) {
    insertCourse.run(course);
  }

  const classNames = ['前端2401班', '前端2402班', '后端2401班', '全栈2401班'];
  const studentNames = [
    '陈明远', '林小雨', '张伟杰', '刘思琪', '王大力',
    '赵文静', '孙志强', '周小红', '吴建国', '郑美玲',
    '黄志勇', '许晓峰', '何雨萱', '胡正阳', '高明月',
    '马思远', '罗晓东', '梁静怡', '谢建华', '宋雅琴',
  ];

  const insertStudent = db.prepare(`
    INSERT INTO students (name, student_no, class_name, phone, email, status, course_ids)
    VALUES (@name, @student_no, @class_name, @phone, @email, @status, @course_ids)
  `);

  for (let i = 0; i < studentNames.length; i++) {
    const courseCount = Math.floor(Math.random() * 3) + 1;
    const courseIds = [];
    while (courseIds.length < courseCount) {
      const id = Math.floor(Math.random() * 12) + 1;
      if (!courseIds.includes(id)) courseIds.push(id);
    }

    insertStudent.run({
      name: studentNames[i],
      student_no: `2024${String(i + 1).padStart(4, '0')}`,
      class_name: classNames[i % classNames.length],
      phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      email: `student${i + 1}@example.com`,
      status: i < 18 ? 'active' : 'inactive',
      course_ids: JSON.stringify(courseIds),
    });
  }

  const insertRecord = db.prepare(`
    INSERT INTO learning_records (student_id, course_id, date, duration)
    VALUES (@student_id, @course_id, @date, @duration)
  `);

  const today = new Date();
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    const recordCount = Math.floor(Math.random() * 10) + 5;
    for (let j = 0; j < recordCount; j++) {
      insertRecord.run({
        student_id: Math.floor(Math.random() * 20) + 1,
        course_id: Math.floor(Math.random() * 12) + 1,
        date: dateStr,
        duration: Math.floor(Math.random() * 90) + 10,
      });
    }
  }

  console.log('Mock 数据初始化完成');
}

function ensureDemoUsers() {
  const users = [
    { username: 'admin', password: 'admin123', name: '管理员', role: 'admin' },
    { username: 'teacher', password: '123456', name: '教师账号', role: 'teacher' },
    { username: 'student', password: '123456', name: '学生账号', role: 'student' },
  ];
  const studentPassword = bcrypt.hashSync('student123', 10);
  db.prepare(`
    UPDATE users
    SET username = ?, password = ?, name = ?, role = ?
    WHERE username = ? AND NOT EXISTS (SELECT 1 FROM users WHERE username = ?)
  `).run('student', studentPassword, '学生账号', 'student', 'viewer', 'student');

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)
  `);

  for (const user of users) {
    insertUser.run(
      user.username,
      bcrypt.hashSync(user.password, 10),
      user.name,
      user.role,
    );
  }

  migrateDefaultPassword('teacher', 'teacher123', '123456');
  migrateDefaultPassword('student', 'student123', '123456');
}

function migrateDefaultPassword(username, oldPassword, newPassword) {
  const user = db.prepare('SELECT id, password FROM users WHERE username = ?').get(username);
  if (user && bcrypt.compareSync(oldPassword, user.password)) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?')
      .run(bcrypt.hashSync(newPassword, 10), user.id);
  }
}

function seedRolesAndPermissions() {
  // 角色和权限字典可以安全反复执行：文案更新会同步到库里，不会破坏已保存的角色授权。
  const insertRole = db.prepare(`
    INSERT INTO roles (code, name, description)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      description = excluded.description
  `);

  for (const role of DEFAULT_ROLES) {
    insertRole.run(role.code, role.name, role.description);
  }

  const insertPermission = db.prepare(`
    INSERT INTO permissions (code, name, module, module_name, sort_order)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      module = excluded.module,
      module_name = excluded.module_name,
      sort_order = excluded.sort_order
  `);
  let sortOrder = 1;
  for (const group of PERMISSION_GROUPS) {
    for (const permission of group.permissions) {
      insertPermission.run(
        permission.code,
        permission.name,
        group.module,
        group.moduleName,
        sortOrder,
      );
      sortOrder += 1;
    }
  }

  // 默认角色权限只写一次，避免用户在“角色权限”页面修改后，重启服务又被种子数据覆盖。
  const migrationKey = 'rbac-default-role-permissions-v2';
  const migrated = db.prepare('SELECT key FROM app_migrations WHERE key = ?').get(migrationKey);
  const getRole = db.prepare('SELECT id FROM roles WHERE code = ?');
  const getPermission = db.prepare('SELECT id FROM permissions WHERE code = ?');
  const insertRolePermission = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    VALUES (?, ?)
  `);

  if (!migrated) {
    for (const [roleCode, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const role = getRole.get(roleCode);
      if (!role) continue;

      for (const permissionCode of permissionCodes) {
        const permission = getPermission.get(permissionCode);
        if (permission) {
          insertRolePermission.run(role.id, permission.id);
        }
      }
    }

    db.prepare('INSERT INTO app_migrations (key) VALUES (?)').run(migrationKey);
  }

  const summaryCrudMigrationKey = 'summary-crud-permissions-v1';
  const summaryCrudMigrated = db.prepare('SELECT key FROM app_migrations WHERE key = ?').get(summaryCrudMigrationKey);
  if (summaryCrudMigrated) return;

  for (const roleCode of ['teacher', 'student']) {
    const role = getRole.get(roleCode);
    if (!role) continue;

    for (const permissionCode of [
      'summary:create',
      'summary:update',
      'summary:delete',
    ]) {
      const permission = getPermission.get(permissionCode);
      if (permission) {
        insertRolePermission.run(role.id, permission.id);
      }
    }
  }
  db.prepare('INSERT INTO app_migrations (key) VALUES (?)').run(summaryCrudMigrationKey);
}
