/*
模块：学习总结路由
定位：为当前登录用户提供自己的学习总结 CRUD；所有查询都按 ctx.state.user.id 隔离数据
接口：
- GET    /api/summary       分页获取自己的总结列表
- GET    /api/summary/:id   查看自己的总结详情
- POST   /api/summary       新增自己的总结
- PUT    /api/summary/:id   编辑自己的总结
- DELETE /api/summary/:id   删除自己的总结
*/
import Router from '@koa/router';
import db from '../database/db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../permissions.js';
import { success, fail } from '../utils/response.js';

const router = new Router();

router.get('/', authenticateToken, requirePermission(PERMISSIONS.SUMMARY_VIEW), async (ctx) => {
  const { page = 1, pageSize = 10, keyword = '' } = ctx.query;
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
  const offset = (normalizedPage - 1) * normalizedPageSize;
  const params = [ctx.state.user.id];
  let where = 'WHERE user_id = ?';

  if (keyword) {
    where += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM learning_summaries ${where}`)
    .get(...params).count;
  const list = db.prepare(`
    SELECT id, title, created_at, updated_at
    FROM learning_summaries
    ${where}
    ORDER BY updated_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, normalizedPageSize, offset);

  success(ctx, {
    list,
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  });
});

router.get('/:id', authenticateToken, requirePermission(PERMISSIONS.SUMMARY_VIEW), async (ctx) => {
  const summary = findOwnSummary(ctx.params.id, ctx.state.user.id);
  if (!summary) {
    return fail(ctx, 404, '学习总结不存在');
  }

  success(ctx, summary);
});

router.post('/', authenticateToken, requirePermission(PERMISSIONS.SUMMARY_CREATE), async (ctx) => {
  const payload = parseSummaryPayload(ctx.request.body);
  if (payload.error) {
    return fail(ctx, 400, payload.error);
  }

  const result = db.prepare(`
    INSERT INTO learning_summaries (user_id, title, content)
    VALUES (?, ?, ?)
  `).run(ctx.state.user.id, payload.title, payload.content);

  const summary = findOwnSummary(result.lastInsertRowid, ctx.state.user.id);
  ctx.status = 201;
  success(ctx, summary);
});

router.put('/:id', authenticateToken, requirePermission(PERMISSIONS.SUMMARY_UPDATE), async (ctx) => {
  const existing = findOwnSummary(ctx.params.id, ctx.state.user.id);
  if (!existing) {
    return fail(ctx, 404, '学习总结不存在');
  }

  const payload = parseSummaryPayload(ctx.request.body);
  if (payload.error) {
    return fail(ctx, 400, payload.error);
  }

  db.prepare(`
    UPDATE learning_summaries
    SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(payload.title, payload.content, ctx.params.id, ctx.state.user.id);

  success(ctx, findOwnSummary(ctx.params.id, ctx.state.user.id));
});

router.delete('/:id', authenticateToken, requirePermission(PERMISSIONS.SUMMARY_DELETE), async (ctx) => {
  const existing = findOwnSummary(ctx.params.id, ctx.state.user.id);
  if (!existing) {
    return fail(ctx, 404, '学习总结不存在');
  }

  db.prepare('DELETE FROM learning_summaries WHERE id = ? AND user_id = ?')
    .run(ctx.params.id, ctx.state.user.id);
  success(ctx, null, '删除成功');
});

function findOwnSummary(id, userId) {
  return db.prepare(`
    SELECT id, title, content, created_at, updated_at
    FROM learning_summaries
    WHERE id = ? AND user_id = ?
  `).get(id, userId);
}

function parseSummaryPayload(body = {}) {
  const title = String(body.title ?? '').trim();
  const content = String(body.content ?? '').trim();

  if (!title) {
    return { error: '标题不能为空' };
  }
  if (!content) {
    return { error: '内容不能为空' };
  }

  return { title, content };
}

export default router;
