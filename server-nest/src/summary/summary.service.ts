// 文件作用：学习总结业务服务，维护当前用户自己的笔记/总结内容并防止跨用户访问。
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { fail } from '../common/api.exception';
import { parsePositiveIntId } from '../common/id.util';
import { formatLocalDateTime } from '../database/date.util';
import { LearningSummaryEntity } from '../database/entities';
import { CreateSummaryDto, SummaryListQueryDto, UpdateSummaryDto } from './dto/summary.dto';

type SummaryPayloadInput = {
  title?: unknown;
  content?: unknown;
};

@Injectable()
export class SummaryService {
  constructor(
    @InjectRepository(LearningSummaryEntity)
    private readonly summaryRepository: Repository<LearningSummaryEntity>,
  ) {}

  // 作用：分页查询当前用户自己的学习总结，支持标题/内容关键词搜索。

  async list(userId: number, query: SummaryListQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 50);
    const keyword = String(query.keyword ?? '').trim();
    const offset = (page - 1) * pageSize;
    const builder = this.summaryRepository
      .createQueryBuilder('summary')
      .where('summary.user_id = :userId', { userId });

    if (keyword) {
      builder.andWhere(new Brackets((query) => {
        query
          .where('summary.title LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('summary.content LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }

    const [rows, total] = await builder
      .orderBy('summary.updated_at', 'DESC')
      .addOrderBy('summary.id', 'DESC')
      .take(pageSize)
      .skip(offset)
      .getManyAndCount();
    const list = rows.map((summary) => ({
      id: summary.id,
      title: summary.title,
      created_at: formatDateTime(summary.created_at),
      updated_at: formatDateTime(summary.updated_at),
    }));

    return { list, total, page, pageSize };
  }

  // 作用：查询当前用户自己的单条总结，防止通过 ID 访问其他用户内容。

  async detail(id: string, userId: number) {
    const summaryId = parsePositiveIntId(id, '学习总结不存在');
    const row = await this.summaryRepository.findOneBy({ id: summaryId, user_id: userId });
    const summary = row ? {
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at),
    } : null;
    if (!summary) fail(404, '学习总结不存在');
    return summary;
  }

  // 作用：为当前用户创建学习总结，内容可包含上传图片返回的 Markdown URL。

  async create(userId: number, body: CreateSummaryDto) {
    const payload = parseSummaryPayload(body);
    const summary = await this.summaryRepository.save(this.summaryRepository.create({
      user_id: userId,
      title: payload.title,
      content: payload.content,
    }));
    return this.detail(String(summary.id), userId);
  }

  // 作用：更新当前用户自己的总结，未传字段沿用原值。

  async update(id: string, userId: number, body: UpdateSummaryDto) {
    const summaryId = parsePositiveIntId(id, '学习总结不存在');
    const existing = await this.summaryRepository.findOneBy({ id: summaryId, user_id: userId });
    if (!existing) fail(404, '学习总结不存在');
    const payload = parseSummaryPayload({
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
    });
    await this.summaryRepository.save({ ...existing, ...payload });
    return this.detail(id, userId);
  }

  // 作用：删除当前用户自己的总结，避免跨用户删除。

  async delete(id: string, userId: number) {
    await this.detail(id, userId);
    await this.summaryRepository.delete({ id: parsePositiveIntId(id, '学习总结不存在'), user_id: userId });
  }
}

// 作用：统一校验学习总结标题和内容，保证创建/编辑规则一致。
function parseSummaryPayload(body: SummaryPayloadInput) {
  const title = String(body?.title ?? '').trim();
  const content = String(body?.content ?? '').trim();
  if (!title) fail(400, '标题不能为空');
  if (!content) fail(400, '内容不能为空');
  return { title, content };
}

const formatDateTime = formatLocalDateTime;
