// 文件作用：端到端接口契约测试，验证 NestJS 后端的 API 路径、响应结构、权限逻辑和旧 Koa 服务保持兼容。
import '../src/config/load-env';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import mysql from 'mysql2/promise';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation.pipe';

async function seedApiContractFixtures(dataSource: DataSource) {
  const categoryId = randomUUID();
  await dataSource.query(
    `INSERT INTO course_categories (id, name, course_count) VALUES (?, ?, ?)`,
    [categoryId, 'Test', 1],
  );

  await dataSource.query(
    `INSERT INTO courses (name, description, instructor, category, category_id, status, student_count, lesson_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Contract Course', 'Contract test course', 'Contract Teacher', 'Test', categoryId, 'published', 1, 3],
  );
  const [{ id: courseId }] = await dataSource.query('SELECT id FROM courses ORDER BY id ASC LIMIT 1');

  await dataSource.query(
    `INSERT INTO students (name, student_no, class_name, phone, email, status, course_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Contract Student', '20240001', 'Contract Class', '13800000000', 'contract-student@example.com', 'active', JSON.stringify([courseId])],
  );
}

describe('NestJS API contract compatible with the Koa server', () => {
  let app: INestApplication;
  let adminToken = '';
  let studentToken = '';
  const tmpRoot = resolve(__dirname, '.tmp');
  const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
  const mysqlPort = Number(process.env.MYSQL_PORT || 3306);
  const mysqlUser = process.env.MYSQL_USER || 'root';
  const mysqlPassword = process.env.MYSQL_PASSWORD || '';
  const mysqlDatabase = `eduflow_contract_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    mkdirSync(tmpRoot, { recursive: true });
    process.env.JWT_SECRET = 'test-secret';
    process.env.SERVE_STATIC = 'false';
    process.env.DATA_ROOT = tmpRoot;
    process.env.MYSQL_HOST = mysqlHost;
    process.env.MYSQL_PORT = String(mysqlPort);
    process.env.MYSQL_USER = mysqlUser;
    process.env.MYSQL_PASSWORD = mysqlPassword;
    process.env.MYSQL_DATABASE = mysqlDatabase;
    process.env.MYSQL_CONNECTION_LIMIT = '5';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    await seedApiContractFixtures(app.get(DataSource));
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.data.token;
  });

  afterAll(async () => {
    await app?.close();
    try {
      const connection = await mysql.createConnection({
        host: mysqlHost,
        port: mysqlPort,
        user: mysqlUser,
        password: mysqlPassword,
      });
      await connection.query(`DROP DATABASE IF EXISTS \`${mysqlDatabase}\``);
      await connection.end();
    } catch {
      // 作用：beforeAll 连接 MySQL 失败时，不让清理阶段再次抛同一个凭据错误。
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('logs in admin and returns the same token/user envelope shape with permissions', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    expect(response.body.code).toBe(0);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      username: 'admin',
      role: 'admin',
    });
    expect(response.body.data.user.password).toBeUndefined();
    expect(response.body.data.user.permissions).toContain('accounts:updateRole');
    adminToken = response.body.data.token;
  });

  it('keeps /auth/me compatible and restores current user permissions from token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      code: 0,
      data: {
        username: 'admin',
        role: 'admin',
      },
    });
    expect(response.body.data.permissions).toContain('dashboard:view');
  });

  it('keeps authentication error messages compatible with Koa', async () => {
    const missingToken = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);
    expect(missingToken.body).toEqual({
      code: 401,
      msg: '未提供认证令牌',
      data: null,
    });

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);
    expect(wrongPassword.body).toEqual({
      code: 401,
      msg: '用户名或密码错误',
      data: null,
    });
  });

  it('rejects a student from account management using latest database permissions', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'student', password: '123456' })
      .expect(200);

    studentToken = login.body.data.token;

    const response = await request(app.getHttpServer())
      .get('/api/system/users')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    expect(response.body).toEqual({
      code: 403,
      msg: '无权限执行该操作',
      data: null,
    });
  });

  it('returns dashboard, course and student list payloads used by the frontend stores', async () => {
    const dashboard = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(dashboard.body.data.stats.totalCourses).toEqual(expect.any(Number));
    expect(Array.isArray(dashboard.body.data.charts.activity)).toBe(true);

    const courses = await request(app.getHttpServer())
      .get('/api/courses?page=1&pageSize=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(courses.body.data).toMatchObject({ page: 1, pageSize: 5 });
    expect(Array.isArray(courses.body.data.list)).toBe(true);

    const students = await request(app.getHttpServer())
      .get('/api/students?page=1&pageSize=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(students.body.data).toMatchObject({ page: 1, pageSize: 5 });
    expect(Array.isArray(students.body.data.list[0].course_ids)).toBe(true);
  });

  it('keeps summary CRUD scoped to the current user', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/api/summary')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: '空内容总结', content: '' })
      .expect(400);
    expect(invalid.body.msg).toBe('内容不能为空');

    const created = await request(app.getHttpServer())
      .post('/api/summary')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'NestJS 迁移测试', content: '权限和用户隔离保持一致' })
      .expect(201);

    expect(created.body.code).toBe(0);
    expect(created.body.data.id).toEqual(expect.any(Number));

    const detail = await request(app.getHttpServer())
      .get(`/api/summary/${created.body.data.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(detail.body.data).toMatchObject({
      title: 'NestJS 迁移测试',
      content: '权限和用户隔离保持一致',
    });

    const list = await request(app.getHttpServer())
      .get('/api/summary?page=1&pageSize=10&keyword=NestJS')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(list.body.data.list[0]).toEqual(expect.objectContaining({
      id: expect.any(Number),
      title: expect.any(String),
      created_at: expect.any(String),
      updated_at: expect.any(String),
    }));
    expect(list.body.data.list[0]).not.toHaveProperty('content');
    expect(list.body.data.list[0]).not.toHaveProperty('user_id');
  });

  it('keeps dynamic role and permission management compatible with the permissions page', async () => {
    const permissions = await request(app.getHttpServer())
      .get('/api/system/permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(permissions.body.data.some((group) => group.module === 'courses')).toBe(true);

    const role = await request(app.getHttpServer())
      .post('/api/system/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Nest 迁移测试角色',
        description: '用于验证新后端角色权限闭环',
        permissions: ['courses:create'],
      })
      .expect(201);

    expect(role.body.data.code).toMatch(/^custom_/);
    expect(role.body.data.permissions).toEqual(expect.arrayContaining(['courses:view', 'courses:create']));
  });

  it('keeps admin-only role mutations protected even when a user has account permissions', async () => {
    const role = await request(app.getHttpServer())
      .post('/api/system/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `账号权限测试角色${Date.now()}`,
        permissions: ['accounts:updateRole'],
      })
      .expect(201);

    const username = `account_perm_${Date.now()}`;
    const account = await request(app.getHttpServer())
      .post('/api/system/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        name: '账号权限测试用户',
        role: role.body.data.code,
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: '123456' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/system/roles')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ name: '非管理员不能新增角色', permissions: ['dashboard:view'] })
      .expect(403);

    expect(response.body).toEqual({
      code: 403,
      msg: '只有管理员可以新增角色',
      data: null,
    });

    await request(app.getHttpServer())
      .delete(`/api/system/users/${account.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/system/roles/${role.body.data.code}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('applies changed role permissions to existing tokens on the next protected request', async () => {
    const connection = await mysql.createConnection({
      host: mysqlHost,
      port: mysqlPort,
      user: mysqlUser,
      password: mysqlPassword,
      database: mysqlDatabase,
    });
    const [rows] = await connection.execute(
      'SELECT permission_code FROM role_permissions WHERE role_code = ?',
      ['teacher'],
    );
    const original = (rows as Array<{ permission_code: string }>).map((row) => row.permission_code);

    try {
      await request(app.getHttpServer())
        .patch('/api/system/roles/teacher/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: ['dashboard:view'] })
        .expect(200);

      const teacherLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'teacher', password: '123456' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/courses')
        .set('Authorization', `Bearer ${teacherLogin.body.data.token}`)
        .expect(403);
    } finally {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM role_permissions WHERE role_code = ?', ['teacher']);
      for (const permission of original) {
        await connection.execute('INSERT INTO role_permissions (role_code, permission_code) VALUES (?, ?)', [
          'teacher',
          permission,
        ]);
      }
      await connection.commit();
      await connection.end();
    }
  });

  it('keeps course create, update, status toggle and delete responses compatible', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'NestJS 课程迁移测试',
        description: '课程 CRUD 兼容验证',
        instructor: '测试老师',
        category: '迁移测试',
        lesson_count: 3,
      })
      .expect(201);

    const id = created.body.data.id;
    expect(created.body.data.status).toBe('draft');

    const updated = await request(app.getHttpServer())
      .put(`/api/courses/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'NestJS 课程迁移测试-更新', status: 'published' })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      id,
      name: 'NestJS 课程迁移测试-更新',
      status: 'published',
    });

    const toggled = await request(app.getHttpServer())
      .patch(`/api/courses/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(toggled.body.data.status).toBe('draft');

    const deleted = await request(app.getHttpServer())
      .delete(`/api/courses/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(deleted.body).toEqual({ code: 0, msg: '删除成功', data: null });
  });

  it('manages course categories and keeps course counts in sync', async () => {
    const categoryNameA = `Category A ${Date.now()}`;
    const categoryNameB = `Category B ${Date.now()}`;

    const categoryA = await request(app.getHttpServer())
      .post('/api/course-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: categoryNameA })
      .expect(201);
    expect(categoryA.body.data).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: categoryNameA,
      course_count: 0,
    }));

    const duplicate = await request(app.getHttpServer())
      .post('/api/course-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: categoryNameA })
      .expect(400);
    expect(duplicate.body.msg).toBe('课程分类已存在');

    const categoryB = await request(app.getHttpServer())
      .post('/api/course-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: categoryNameB })
      .expect(201);

    const createdCourse = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Course with category ${Date.now()}`,
        category_id: categoryA.body.data.id,
        lesson_count: 2,
      })
      .expect(201);
    expect(createdCourse.body.data).toEqual(expect.objectContaining({
      category_id: categoryA.body.data.id,
      category: categoryNameA,
    }));

    const afterCreate = await request(app.getHttpServer())
      .get('/api/course-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterCreate.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: categoryA.body.data.id, course_count: 1 }),
      expect.objectContaining({ id: categoryB.body.data.id, course_count: 0 }),
    ]));
    expect(afterCreate.body.data.findIndex((category) => category.id === categoryB.body.data.id))
      .toBeLessThan(afterCreate.body.data.findIndex((category) => category.id === categoryA.body.data.id));

    const filteredCategories = await request(app.getHttpServer())
      .get(`/api/course-categories?keyword=${encodeURIComponent('Category A')}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(filteredCategories.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: categoryA.body.data.id }),
    ]));
    expect(filteredCategories.body.data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: categoryB.body.data.id }),
    ]));

    const deleteUsed = await request(app.getHttpServer())
      .delete(`/api/course-categories/${categoryA.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    expect(deleteUsed.body.msg).toBe('该分类下已有课程，不能删除');

    const renamedCategory = await request(app.getHttpServer())
      .put(`/api/course-categories/${categoryA.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${categoryNameA} Renamed` })
      .expect(200);
    expect(renamedCategory.body.data.name).toBe(`${categoryNameA} Renamed`);

    const courseAfterRename = await request(app.getHttpServer())
      .get(`/api/courses/${createdCourse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(courseAfterRename.body.data.category).toBe(`${categoryNameA} Renamed`);

    await request(app.getHttpServer())
      .put(`/api/courses/${createdCourse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category_id: categoryB.body.data.id })
      .expect(200);

    const legacyCategoryUpdate = await request(app.getHttpServer())
      .put(`/api/courses/${createdCourse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'Legacy text should not desync relation' })
      .expect(200);
    expect(legacyCategoryUpdate.body.data).toEqual(expect.objectContaining({
      category_id: categoryB.body.data.id,
      category: categoryNameB,
    }));

    const afterMove = await request(app.getHttpServer())
      .get('/api/course-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterMove.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: categoryA.body.data.id, course_count: 0 }),
      expect.objectContaining({ id: categoryB.body.data.id, course_count: 1 }),
    ]));

    await request(app.getHttpServer())
      .delete(`/api/courses/${createdCourse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const afterDeleteCourse = await request(app.getHttpServer())
      .get('/api/course-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterDeleteCourse.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: categoryB.body.data.id, course_count: 0 }),
    ]));

    await request(app.getHttpServer())
      .delete(`/api/course-categories/${categoryA.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('keeps DTO validation errors in the legacy envelope shape', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '非法状态课程',
        status: 'archived',
      })
      .expect(400);

    expect(response.body).toEqual({
      code: 400,
      msg: '课程状态不合法',
      data: null,
    });
  });

  it('strips unknown DTO fields without rejecting compatible frontend payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '未知字段兼容测试课程',
        description: '验证 whitelist 剥离未声明字段',
        unexpected_field: 'should not be persisted',
      })
      .expect(201);

    expect(response.body.code).toBe(0);
    expect(response.body.data).not.toHaveProperty('unexpected_field');
  });

  it('keeps invalid route ids as stable not-found responses', async () => {
    const course = await request(app.getHttpServer())
      .get('/api/courses/not-a-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(course.body.msg).toBe('课程不存在');

    const student = await request(app.getHttpServer())
      .get('/api/students/not-a-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(student.body.msg).toBe('学生不存在');

    const summary = await request(app.getHttpServer())
      .get('/api/summary/not-a-number')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
    expect(summary.body.msg).toBe('学习总结不存在');
  });

  it('keeps student validation, detail course expansion and course count recalculation compatible', async () => {
    const courses = await request(app.getHttpServer())
      .get('/api/courses?page=1&pageSize=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const courseId = courses.body.data.list[0].id;
    const studentNo = String(26000000 + Math.floor(Math.random() * 1000000)).padStart(8, '0').slice(0, 8);

    const invalid = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '校验失败学生',
        student_no: 'abc',
        phone: '13800000000',
        email: 'invalid@example.com',
        course_ids: [courseId],
      })
      .expect(400);
    expect(invalid.body.msg).toBe('学号格式应为 8 位数字');

    const invalidPhone = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '手机号失败学生',
        student_no: studentNo,
        class_name: '迁移测试班',
        phone: '123',
        email: 'nest-student@example.com',
        status: 'active',
        course_ids: [courseId],
      })
      .expect(400);
    expect(invalidPhone.body.msg).toBe('手机号格式不正确');

    const invalidEmail = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '邮箱失败学生',
        student_no: studentNo,
        class_name: '迁移测试班',
        phone: '13800000000',
        email: 'bad-email',
        status: 'active',
        course_ids: [courseId],
      })
      .expect(400);
    expect(invalidEmail.body.msg).toBe('邮箱格式不正确');

    const invalidStatus = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '状态失败学生',
        student_no: studentNo,
        class_name: '迁移测试班',
        phone: '13800000000',
        email: 'nest-student@example.com',
        status: 'paused',
        course_ids: [courseId],
      })
      .expect(400);
    expect(invalidStatus.body.msg).toBe('学生状态不合法');

    const emptyCourses = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '课程失败学生',
        student_no: studentNo,
        class_name: '迁移测试班',
        phone: '13800000000',
        email: 'nest-student@example.com',
        status: 'active',
        course_ids: [],
      })
      .expect(400);
    expect(emptyCourses.body.msg).toBe('请至少选择一门课程');

    const created = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'NestJS 学生迁移测试',
        student_no: studentNo,
        class_name: '迁移测试班',
        phone: '13800000000',
        email: 'nest-student@example.com',
        course_ids: [courseId, courseId],
      })
      .expect(201);

    expect(created.body.data.course_ids).toEqual([courseId]);

    const checkNo = await request(app.getHttpServer())
      .get(`/api/students/check-no?student_no=${studentNo}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(checkNo.body.data).toEqual({ unique: false });

    const checkNoWithLegacyEmptyPagination = await request(app.getHttpServer())
      .get(`/api/students/check-no?student_no=${studentNo}&page=undefined&pageSize=undefined`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(checkNoWithLegacyEmptyPagination.body.data).toEqual({ unique: false });

    const filtered = await request(app.getHttpServer())
      .get(`/api/students?className=${encodeURIComponent('迁移测试班')}&courseId=${courseId}&page=1&pageSize=10`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(filtered.body.data.list.map((student) => student.id)).toContain(created.body.data.id);

    const detail = await request(app.getHttpServer())
      .get(`/api/students/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.data.enrolledCourses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: courseId }),
    ]));

    await request(app.getHttpServer())
      .delete(`/api/students/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('keeps image upload and /api/static image access compatible with summary markdown', async () => {
    const image = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
    ]);

    const uploaded = await request(app.getHttpServer())
      .post('/api/upload/summary-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', image, { filename: 'test.png', contentType: 'image/png' })
      .expect(200);

    expect(uploaded.body.data.url).toMatch(/^\/api\/static\/uploads\/summary\//);
    expect(uploaded.body.data.filename).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get(uploaded.body.data.url)
      .expect('Content-Type', /image\/png/)
      .expect(200);
  });

  it('keeps static file safety checks compatible with Koa', async () => {
    const svgDir = resolve(tmpRoot, 'uploads', 'summary', '1');
    mkdirSync(svgDir, { recursive: true });
    writeFileSync(resolve(svgDir, 'test.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    await request(app.getHttpServer())
      .get('/api/static/uploads/summary/1/test.svg')
      .expect('Content-Type', /image\/svg\+xml/)
      .expect(200);

    const unsupported = await request(app.getHttpServer())
      .get('/api/static/summary.md')
      .expect(403);
    expect(unsupported.body).toEqual({
      code: 403,
      msg: '不支持的文件类型',
      data: null,
    });

    const missing = await request(app.getHttpServer())
      .get('/api/static/uploads/summary/missing.png')
      .expect(404);
    expect(missing.body).toEqual({
      code: 404,
      msg: '文件不存在',
      data: null,
    });
  });
});
