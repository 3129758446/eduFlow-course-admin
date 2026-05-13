/* 
模块：学生路由
接口：
- GET    /api/students            列表（搜索/筛选/分页/按课程过滤）
- GET    /api/students/classes    班级列表
- GET    /api/students/:id        详情（含已选课程简表）
- POST   /api/students            新增（学号唯一、字段校验、课程有效性校验）
- PUT    /api/students/:id        更新（同上）
- DELETE /api/students/:id        删除
要点：操作成功后同步回写 courses.student_count 以保证统计口径一致
*/
import Router from '@koa/router';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';

const router = new Router();

router.get('/', authenticateToken, async (ctx) => {
  const { keyword = '', className = '', status = '', courseId = '', page = 1, pageSize = 10 } = ctx.query;
  const offset = (Number(page) - 1) * Number(pageSize);

  let where = 'WHERE 1=1';
  const params = [];

  if (keyword) {
    where += ' AND (name LIKE ? OR student_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (className) {
    where += ' AND class_name = ?';
    params.push(className);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  let rows = db.prepare(`SELECT * FROM students ${where} ORDER BY created_at DESC`).all(...params);

  // 因为 course_ids 存在 JSON 字符串列中，按课程筛选只能先取出后再做内存过滤。
  if (courseId) {
    rows = rows.filter((student) => {
      const ids = JSON.parse(student.course_ids || '[]');
      return ids.includes(Number(courseId));
    });
  }

  const total = rows.length;
  const list = rows.slice(offset, offset + Number(pageSize)).map((student) => ({
    ...student,
    course_ids: JSON.parse(student.course_ids || '[]'),
  }));

  success(ctx, { list, total, page: Number(page), pageSize: Number(pageSize) });
});

router.get('/classes', authenticateToken, async (ctx) => {
  const classes = db.prepare("SELECT DISTINCT class_name FROM students WHERE class_name != '' ORDER BY class_name")
    .all()
    .map((row) => row.class_name);
  success(ctx, classes);
});

router.get('/check-no', authenticateToken, async (ctx) => {
  const studentNo = normalizeText(ctx.query.student_no);
  const excludeId = Number(ctx.query.excludeId || 0);

  if (!studentNo) {
    return fail(ctx, 400, '学号不能为空');
  }

  const existing = excludeId > 0
    ? db.prepare('SELECT id FROM students WHERE student_no = ? AND id != ?').get(studentNo, excludeId)
    : db.prepare('SELECT id FROM students WHERE student_no = ?').get(studentNo);

  success(ctx, { unique: !existing });
});

router.get('/:id', authenticateToken, async (ctx) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(ctx.params.id);
  if (!student) {
    return fail(ctx, 404, '学生不存在');
  }
  student.course_ids = JSON.parse(student.course_ids || '[]');

  const courses = db.prepare('SELECT id, name FROM courses').all();
  const enrolledCourses = courses.filter((course) => student.course_ids.includes(course.id));

  success(ctx, { ...student, enrolledCourses });
});

router.post('/', authenticateToken, async (ctx) => {
  // 新增与编辑共用同一套 payload 解析逻辑，保证前后端校验口径一致。
  const payload = parseStudentPayload(ctx.request.body);
  if (payload.error) {
    return fail(ctx, 400, payload.error);
  }

  const existing = db.prepare('SELECT id FROM students WHERE student_no = ?').get(payload.student_no);
  if (existing) {
    return fail(ctx, 400, '学号已存在');
  }

  const invalidCourseIds = findInvalidCourseIds(payload.course_ids);
  if (invalidCourseIds.length > 0) {
    return fail(ctx, 400, '所选课程不存在');
  }

  const result = db.prepare(`
    INSERT INTO students (name, student_no, class_name, phone, email, status, course_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.name,
    payload.student_no,
    payload.class_name,
    payload.phone,
    payload.email,
    payload.status,
    JSON.stringify(payload.course_ids)
  );

  // 学生选课变化会影响课程统计卡片和图表，因此每次变更后都重算 student_count。
  updateCourseCounts();

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid);
  student.course_ids = JSON.parse(student.course_ids || '[]');

  ctx.status = 201;
  success(ctx, student);
});

router.put('/:id', authenticateToken, async (ctx) => {
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(ctx.params.id);
  if (!existing) {
    return fail(ctx, 404, '学生不存在');
  }

  // 编辑场景允许缺省字段，parseStudentPayload 会回退到 existing 中的旧值。
  const payload = parseStudentPayload(ctx.request.body, existing);
  if (payload.error) {
    return fail(ctx, 400, payload.error);
  }

  const duplicate = db.prepare('SELECT id FROM students WHERE student_no = ? AND id != ?')
    .get(payload.student_no, ctx.params.id);
  if (duplicate) {
    return fail(ctx, 400, '学号已存在');
  }

  const invalidCourseIds = findInvalidCourseIds(payload.course_ids);
  if (invalidCourseIds.length > 0) {
    return fail(ctx, 400, '所选课程不存在');
  }

  db.prepare(`
    UPDATE students
    SET name = ?, student_no = ?, class_name = ?, phone = ?, email = ?, status = ?, course_ids = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    payload.name,
    payload.student_no,
    payload.class_name,
    payload.phone,
    payload.email,
    payload.status,
    JSON.stringify(payload.course_ids),
    ctx.params.id
  );

  updateCourseCounts();

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(ctx.params.id);
  student.course_ids = JSON.parse(student.course_ids || '[]');

  success(ctx, student);
});

router.delete('/:id', authenticateToken, async (ctx) => {
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(ctx.params.id);
  if (!existing) {
    return fail(ctx, 404, '学生不存在');
  }

  db.prepare('DELETE FROM students WHERE id = ?').run(ctx.params.id);
  updateCourseCounts();

  success(ctx, null, '删除成功');
});

function updateCourseCounts() {
  const courses = db.prepare('SELECT id FROM courses').all();
  const students = db.prepare('SELECT course_ids FROM students').all();

  // 课程的 student_count 是冗余统计字段，用空间换取列表/图表查询速度。
  for (const course of courses) {
    const count = students.filter((student) => {
      const ids = JSON.parse(student.course_ids || '[]');  
      return ids.includes(course.id);
    }).length;
    db.prepare('UPDATE courses SET student_count = ? WHERE id = ?').run(count, course.id);
  }
}

function parseStudentPayload(body = {}, existing = null) {
  const rawCourseIds = body.course_ids ?? (existing ? JSON.parse(existing.course_ids || '[]') : []);
  const courseIds = normalizeCourseIds(rawCourseIds);

  if (courseIds === null) {
    return { error: 'course_ids 必须是数字数组' };
  }

  const payload = {
    name: normalizeText(body.name, existing?.name ?? ''),
    student_no: normalizeText(body.student_no, existing?.student_no ?? ''),
    class_name: normalizeText(body.class_name, existing?.class_name ?? ''),
    phone: normalizeText(body.phone, existing?.phone ?? ''),
    email: normalizeText(body.email, existing?.email ?? ''),
    status: normalizeText(body.status, existing?.status ?? 'active') || 'active',
    course_ids: courseIds,
  };

  // 这里集中完成必填、格式和枚举合法性校验，保持 POST/PUT 逻辑一致。
  if (!payload.name) {
    return { error: '学生姓名不能为空' };
  }
  if (!payload.student_no) {
    return { error: '学号不能为空' };
  }
  if (!/^\d{8}$/.test(payload.student_no)) {
    return { error: '学号格式应为 8 位数字' };
  }
  if (!/^1[3-9]\d{9}$/.test(payload.phone)) {
    return { error: '手机号格式不正确' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { error: '邮箱格式不正确' };
  }
  if (!['active', 'inactive'].includes(payload.status)) {
    return { error: '学生状态不合法' };
  }
  if (payload.course_ids.length === 0) {
    return { error: '请至少选择一门课程' };
  }

  return payload;
}

function normalizeCourseIds(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = [];
  for (const item of value) {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    // 顺手去重，避免一个学生重复勾选同一课程。
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}

function normalizeText(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

function findInvalidCourseIds(courseIds) {
  if (courseIds.length === 0) {
    return [];
  }

  const placeholders = courseIds.map(() => '?').join(', ');
  const rows = db.prepare(`SELECT id FROM courses WHERE id IN (${placeholders})`).all(...courseIds);
  const validIds = new Set(rows.map((row) => row.id));

  // 返回非法 id 列表，便于后续扩展成更精细的错误提示。
  return courseIds.filter((id) => !validIds.has(id));
}

export default router;
