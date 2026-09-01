// 文件作用：课程业务服务，处理课程查询筛选、增删改和上下架状态切换。
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { fail } from '../common/api.exception';
import { parsePositiveIntId } from '../common/id.util';
import { CourseEntity } from '../database/entities';
import { CourseListQueryDto, CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  // 作用：提供课程列表分页、关键词/状态/分类筛选和表格排序，响应结构保持旧 Koa 接口一致。

  async list(query: CourseListQueryDto) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const { keyword, status, category, sortField, sortOrder } = query;
    const offset = (page - 1) * pageSize;
    const builder = this.courseRepository.createQueryBuilder('course');

    if (keyword) {
      builder.andWhere('(course.name LIKE :keyword OR course.instructor LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }
    if (status) {
      builder.andWhere('course.status = :status', { status });
    }
    if (category) {
      builder.andWhere('course.category = :category', { category });
    }

    const allowedSortFields = ['student_count', 'lesson_count', 'created_at', 'name'];
    let sortColumn = 'created_at';
    let sortDirection: 'ASC' | 'DESC' = 'DESC';
    if (sortField && allowedSortFields.includes(sortField) && sortOrder && ['ascend', 'descend'].includes(sortOrder)) {
      sortColumn = sortField;
      sortDirection = sortOrder === 'ascend' ? 'ASC' : 'DESC';
    }

    const [list, total] = await builder
      .orderBy(`course.${sortColumn}`, sortDirection)
      .take(pageSize)
      .skip(offset)
      .getManyAndCount();
    return { list, total, page, pageSize };
  }

  // 作用：返回课程分类下拉选项，供前端课程筛选器使用。

  async categories() {
    const rows = await this.courseRepository
      .createQueryBuilder('course')
      .select('DISTINCT course.category', 'category')
      .where("course.category != ''")
      .orderBy('course.category', 'ASC')
      .getRawMany<{ category: string }>();
    return rows.map((row) => row.category);
  }

  // 作用：按课程 ID 查询详情，不存在时返回旧接口一致的 404。

  async detail(id: string) {
    const courseId = parsePositiveIntId(id, '课程不存在');
    const course = await this.courseRepository.findOneBy({ id: courseId });
    if (!course) fail(404, '课程不存在');
    return course;
  }

  // 作用：创建课程，默认状态为 draft，保留 Koa 版本 201 创建语义。

  async create(body: CreateCourseDto) {
    const { name, description, instructor, category, status, lesson_count } = body;

    const course = await this.courseRepository.save(this.courseRepository.create({
      name: String(name),
      description: String(description || ''),
      instructor: String(instructor || ''),
      category: String(category || ''),
      status: String(status || 'draft'),
      lesson_count: Number(lesson_count || 0),
    }));

    return this.detail(String(course.id));
  }

  // 作用：更新课程基本信息，未传字段沿用原值，避免前端局部编辑时覆盖为空。

  async update(id: string, body: UpdateCourseDto) {
    const courseId = parsePositiveIntId(id, '课程不存在');
    const existing = await this.courseRepository.findOneBy({ id: courseId });
    if (!existing) fail(404, '课程不存在');
    const { name, description, instructor, category, status, lesson_count } = body;

    await this.courseRepository.save({
      ...existing,
      name: String(name ?? existing.name),
      description: String(description ?? existing.description ?? ''),
      instructor: String(instructor ?? existing.instructor ?? ''),
      category: String(category ?? existing.category ?? ''),
      status: String(status ?? existing.status ?? 'draft'),
      lesson_count: Number(lesson_count ?? existing.lesson_count ?? 0),
    });
    return this.detail(id);
  }

  // 作用：删除课程；接口响应消息由 controller 统一返回“删除成功”。

  async delete(id: string) {
    const courseId = parsePositiveIntId(id, '课程不存在');
    const existing = await this.courseRepository.findOneBy({ id: courseId });
    if (!existing) fail(404, '课程不存在');
    await this.courseRepository.delete({ id: courseId });
  }

  // 作用：在 published 和 draft 之间切换课程状态，匹配前端上下架操作。

  async toggleStatus(id: string) {
    const existing = await this.courseRepository.findOneBy({ id: parsePositiveIntId(id, '课程不存在') });
    if (!existing) fail(404, '课程不存在');
    const newStatus = existing.status === 'published' ? 'draft' : 'published';
    await this.courseRepository.save({ ...existing, status: newStatus });
    return this.detail(id);
  }
}
