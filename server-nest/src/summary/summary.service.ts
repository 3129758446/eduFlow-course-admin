// 文件作用：学习总结业务服务，维护当前用户自己的笔记/总结内容并防止跨用户访问。
import { Injectable } from '@nestjs/common';
import { fail } from '../common/api.exception';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SummaryService {
  constructor(private readonly database: DatabaseService) {}

  // 作用：分页查询当前用户自己的学习总结，支持标题/内容关键词搜索。

  async list(userId: number, query: Record<string, string>) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 50);
    const keyword = String(query.keyword ?? '').trim();
    const offset = (page - 1) * pageSize;
    let where = 'WHERE user_id = ?';
    const params: Array<string | number> = [userId];

    if (keyword) {
      where += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const total = await this.database.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM learning_summaries ${where}`,
      params,
    );
    const list = await this.database.all(
      `
        SELECT
          id,
          title,
          DATE_FORMAT(DATE_ADD(created_at, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(DATE_ADD(updated_at, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM learning_summaries
        ${where}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset],
    );

    return { list, total: Number(total?.count ?? 0), page, pageSize };
  }

  // 作用：查询当前用户自己的单条总结，防止通过 ID 访问其他用户内容。

  async detail(id: string, userId: number) {
    const summary = await this.database.get(
      `
        SELECT
          id,
          title,
          content,
          DATE_FORMAT(DATE_ADD(created_at, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(DATE_ADD(updated_at, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM learning_summaries
        WHERE id = ? AND user_id = ?
      `,
      [id, userId],
    );
    if (!summary) fail(404, '学习总结不存在');
    return summary;
  }

  // 作用：为当前用户创建学习总结，内容可包含上传图片返回的 Markdown URL。

  async create(userId: number, body: Record<string, unknown>) {
    const payload = parseSummaryPayload(body);
    const result = await this.database.run(
      `
        INSERT INTO learning_summaries (user_id, title, content)
        VALUES (?, ?, ?)
      `,
      [userId, payload.title, payload.content],
    );
    return this.detail(String(result.insertId), userId);
  }

  // 作用：更新当前用户自己的总结，未传字段沿用原值。

  async update(id: string, userId: number, body: Record<string, unknown>) {
    const existing = await this.detail(id, userId) as { title: string; content: string };
    const payload = parseSummaryPayload({
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
    });
    await this.database.run(
      `
        UPDATE learning_summaries SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
      [payload.title, payload.content, id, userId],
    );
    return this.detail(id, userId);
  }

  // 作用：删除当前用户自己的总结，避免跨用户删除。

  async delete(id: string, userId: number) {
    await this.detail(id, userId);
    await this.database.run('DELETE FROM learning_summaries WHERE id = ? AND user_id = ?', [id, userId]);
  }
}

// 作用：统一校验学习总结标题和内容，保证创建/编辑规则一致。
function parseSummaryPayload(body: Record<string, unknown>) {
  const title = String(body?.title ?? '').trim();
  const content = String(body?.content ?? '').trim();
  if (!title) fail(400, '标题不能为空');
  if (!content) fail(400, '内容不能为空');
  return { title, content };
}
