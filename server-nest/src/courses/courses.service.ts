// 文件作用：课程业务服务，处理课程查询筛选、增删改和上下架状态切换。
import { Injectable } from '@nestjs/common';
import { fail } from '../common/api.exception';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CoursesService {
  constructor(private readonly database: DatabaseService) {}

  // 作用：提供课程列表分页、关键词/状态/分类筛选和表格排序，响应结构保持旧 Koa 接口一致。

  async list(query: Record<string, string>) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const { keyword, status, category, sortField, sortOrder } = query;
    const offset = (page - 1) * pageSize;
    let where = 'WHERE 1=1';
    const params: Array<string | number> = [];

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
    if (sortField && allowedSortFields.includes(sortField) && ['ascend', 'descend'].includes(sortOrder)) {
      orderBy = `ORDER BY ${sortField} ${sortOrder === 'ascend' ? 'ASC' : 'DESC'}`;
    }

    const total = await this.database.get<{ count: number }>(`SELECT COUNT(*) as count FROM courses ${where}`, params);
    const list = await this.database.all(
      `SELECT * FROM courses ${where} ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
    return { list, total: Number(total?.count ?? 0), page, pageSize };
  }

  // 作用：返回课程分类下拉选项，供前端课程筛选器使用。

  async categories() {
    const rows = await this.database.all<{ category: string }>(
      "SELECT DISTINCT category FROM courses WHERE category != '' ORDER BY category",
    );
    return rows.map((row) => row.category);
  }

  // 作用：按课程 ID 查询详情，不存在时返回旧接口一致的 404。

  async detail(id: string) {
    const course = await this.database.get('SELECT * FROM courses WHERE id = ?', [id]);
    if (!course) fail(404, '课程不存在');
    return course;
  }

  // 作用：创建课程，默认状态为 draft，保留 Koa 版本 201 创建语义。

  async create(body: Record<string, unknown>) {
    const { name, description, instructor, category, status, lesson_count } = body;
    if (!name) fail(400, '课程名称不能为空');

    const result = await this.database.run(
      `
        INSERT INTO courses (name, description, instructor, category, status, lesson_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        String(name),
        String(description || ''),
        String(instructor || ''),
        String(category || ''),
        String(status || 'draft'),
        Number(lesson_count || 0),
      ],
    );

    return this.detail(String(result.insertId));
  }

  // 作用：更新课程基本信息，未传字段沿用原值，避免前端局部编辑时覆盖为空。

  async update(id: string, body: Record<string, unknown>) {
    const existing = await this.database.get<Record<string, unknown>>('SELECT * FROM courses WHERE id = ?', [id]);
    if (!existing) fail(404, '课程不存在');
    const { name, description, instructor, category, status, lesson_count } = body;

    await this.database.run(
      `
        UPDATE courses
        SET name = ?, description = ?, instructor = ?, category = ?, status = ?, lesson_count = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        String(name ?? existing.name),
        String(description ?? existing.description ?? ''),
        String(instructor ?? existing.instructor ?? ''),
        String(category ?? existing.category ?? ''),
        String(status ?? existing.status ?? 'draft'),
        Number(lesson_count ?? existing.lesson_count ?? 0),
        id,
      ],
    );
    return this.detail(id);
  }

  // 作用：删除课程；接口响应消息由 controller 统一返回“删除成功”。

  async delete(id: string) {
    const existing = await this.database.get('SELECT * FROM courses WHERE id = ?', [id]);
    if (!existing) fail(404, '课程不存在');
    await this.database.run('DELETE FROM courses WHERE id = ?', [id]);
  }

  // 作用：在 published 和 draft 之间切换课程状态，匹配前端上下架操作。

  async toggleStatus(id: string) {
    const existing = await this.database.get<{ status: string }>('SELECT * FROM courses WHERE id = ?', [id]);
    if (!existing) fail(404, '课程不存在');
    const newStatus = existing.status === 'published' ? 'draft' : 'published';
    await this.database.run('UPDATE courses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    return this.detail(id);
  }
}
