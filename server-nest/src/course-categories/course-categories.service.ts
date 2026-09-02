import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Like, Repository } from 'typeorm';
import { fail } from '../common/api.exception';
import { CourseCategoryEntity, CourseEntity } from '../database/entities';
import { SaveCourseCategoryDto } from './dto/course-category.dto';

@Injectable()
export class CourseCategoriesService {
  constructor(
    @InjectRepository(CourseCategoryEntity)
    private readonly categoryRepository: Repository<CourseCategoryEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async list(keyword?: string) {
    const name = String(keyword ?? '').trim();
    return this.categoryRepository.find({
      where: name ? { name: Like(`%${name}%`) } : undefined,
      order: { created_at: 'DESC', name: 'ASC' },
    });
  }

  async create(body: SaveCourseCategoryDto) {
    const name = String(body?.name ?? '').trim();
    if (!name) fail(400, '课程分类名称不能为空');
    if (await this.categoryRepository.findOneBy({ name })) fail(400, '课程分类已存在');

    return this.categoryRepository.save(this.categoryRepository.create({
      id: randomUUID(),
      name,
      course_count: 0,
    }));
  }

  async update(id: string, body: SaveCourseCategoryDto) {
    const name = String(body?.name ?? '').trim();
    if (!name) fail(400, '课程分类名称不能为空');
    const category = await this.categoryRepository.findOneBy({ id });
    if (!category) fail(404, '课程分类不存在');

    const duplicate = await this.categoryRepository.findOneBy({ name });
    if (duplicate && duplicate.id !== id) fail(400, '课程分类已存在');

    return this.dataSource.transaction(async (manager) => {
      await manager.update(CourseCategoryEntity, { id }, { name });
      await manager.update(CourseEntity, { category_id: id }, { category: name });
      return manager.findOneByOrFail(CourseCategoryEntity, { id });
    });
  }

  async delete(id: string) {
    const category = await this.categoryRepository.findOneBy({ id });
    if (!category) fail(404, '课程分类不存在');

    const actualCount = await this.courseRepository.countBy({ category_id: id });
    if (actualCount !== category.course_count) {
      await this.categoryRepository.update({ id }, { course_count: actualCount });
    }
    if (actualCount > 0) fail(400, '该分类下已有课程，不能删除');

    await this.categoryRepository.delete({ id });
  }
}
