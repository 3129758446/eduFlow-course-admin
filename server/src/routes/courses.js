/* 
模块：课程路由
接口：
- GET    /api/courses              列表（搜索/筛选/排序/分页）
- GET    /api/courses/categories   分类去重列表
- GET    /api/courses/:id          详情
- POST   /api/courses              新增
- PUT    /api/courses/:id          更新
- DELETE /api/courses/:id          删除
- PATCH  /api/courses/:id/status   发布/下架切换
要点：排序字段白名单；删除/切换状态后返回更新后的对象或 null
*/
import Router from '@koa/router';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';

const router = new Router();

router.get('/', authenticateToken, async (ctx) => {
  const { keyword = '', status = '', category = '', page = 1, pageSize = 10, sortField = '', sortOrder = '' } = ctx.query;
  const offset = (Number(page) - 1) * Number(pageSize);

  let where = 'WHERE 1=1';
  const params = [];

  // 通过 where + params 逐步拼接查询条件，既灵活又能保留参数化查询的安全性。
  if (keyword) {
    where += ' AND (name LIKE ? OR instructor LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }

  const allowedSortFields = ['student_count', 'lesson_count', 'created_at', 'name'];
  let orderBy = 'ORDER BY created_at DESC';
  // 排序字段必须走白名单，避免用户直接把任意 SQL 字段拼进 ORDER BY。
  if (sortField && allowedSortFields.includes(sortField) && ['ascend', 'descend'].includes(sortOrder)) {
    const dir = sortOrder === 'ascend' ? 'ASC' : 'DESC';
    orderBy = `ORDER BY ${sortField} ${dir}`;
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM courses ${where}`).get(...params).count;
  const list = db.prepare(`SELECT * FROM courses ${where} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, Number(pageSize), offset);

  success(ctx, { list, total, page: Number(page), pageSize: Number(pageSize) });
});

router.get('/categories', authenticateToken, async (ctx) => {
  const categories = db.prepare("SELECT DISTINCT category FROM courses WHERE category != '' ORDER BY category")
    .all()
    .map(r => r.category);
  success(ctx, categories);
});

router.get('/:id', authenticateToken, async (ctx) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(ctx.params.id);
  if (!course) {
    return fail(ctx, 404, '课程不存在');
  }
  success(ctx, course);
});

router.post('/', authenticateToken, async (ctx) => {
  const { name, description, instructor, category, status, lesson_count } = ctx.request.body;

  if (!name) {
    return fail(ctx, 400, '课程名称不能为空');
  }

  // 这里对可选字段做兜底，保持数据库中始终写入可预期的默认值。
  const result = db.prepare(`
    INSERT INTO courses (name, description, instructor, category, status, lesson_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, description || '', instructor || '', category || '', status || 'draft', lesson_count || 0);

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
  ctx.status = 201;
  success(ctx, course);
});

router.put('/:id', authenticateToken, async (ctx) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(ctx.params.id);
  if (!existing) {
    return fail(ctx, 404, '课程不存在');
  }

  const { name, description, instructor, category, status, lesson_count } = ctx.request.body;

  // 更新接口支持部分字段修改；未传字段就沿用旧值。
  db.prepare(`
    UPDATE courses SET name = ?, description = ?, instructor = ?, category = ?, status = ?, lesson_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name ?? existing.name,
    description ?? existing.description,
    instructor ?? existing.instructor,
    category ?? existing.category,
    status ?? existing.status,
    lesson_count ?? existing.lesson_count,
    ctx.params.id
  );

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(ctx.params.id);
  success(ctx, course);
});

router.delete('/:id', authenticateToken, async (ctx) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(ctx.params.id);
  if (!existing) {
    return fail(ctx, 404, '课程不存在');
  }

  db.prepare('DELETE FROM courses WHERE id = ?').run(ctx.params.id);
  success(ctx, null, '删除成功');
});

router.patch('/:id/status', authenticateToken, async (ctx) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(ctx.params.id);
  if (!existing) {
    return fail(ctx, 404, '课程不存在');
  }

  // 课程状态只有 published/draft 两种，因此这里直接做二元切换。
  const newStatus = existing.status === 'published' ? 'draft' : 'published';
  db.prepare('UPDATE courses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStatus, ctx.params.id);

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(ctx.params.id);
  success(ctx, course);
});

export default router;
