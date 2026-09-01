// 文件作用：学员业务服务，维护学员资料、选课关系和课程人数统计同步。
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { fail } from '../common/api.exception';
import { parsePositiveIntId } from '../common/id.util';
import { CourseEntity, StudentEntity } from '../database/entities';

type StudentRow = StudentEntity & { course_ids?: string };
type StudentPayload =
  | { error: string }
  | {
      name: string;
      student_no: string;
      class_name: string;
      phone: string;
      email: string;
      status: string;
      course_ids: number[];
    };

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepository: Repository<StudentEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // 作用：提供学员列表分页、关键词/班级/状态筛选，并把 course_ids JSON 字符串转成数组。

  async list(query: Record<string, string>) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const { keyword, status } = query;
    const className = query.className ?? query.class_name;
    const courseId = query.courseId ?? query.course_id;
    const offset = (page - 1) * pageSize;
    const builder = this.studentRepository.createQueryBuilder('student');

    if (keyword) {
      builder.andWhere('(student.name LIKE :keyword OR student.student_no LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }
    if (className) {
      builder.andWhere('student.class_name = :className', { className });
    }
    if (status) {
      builder.andWhere('student.status = :status', { status });
    }

    let rows = await builder.orderBy('student.created_at', 'DESC').getMany();
    if (courseId) {
      rows = rows.filter((student) => parseCourseIds(student.course_ids).includes(Number(courseId)));
    }

    const total = rows.length;
    const list = rows.slice(offset, offset + pageSize).map((student) => ({
      ...student,
      course_ids: parseCourseIds(student.course_ids),
    }));
    return { list, total, page, pageSize };
  }

  // 作用：返回所有班级名称，供前端学员列表筛选器使用。

  async classes() {
    const rows = await this.studentRepository
      .createQueryBuilder('student')
      .select('DISTINCT student.class_name', 'class_name')
      .where("student.class_name != ''")
      .orderBy('student.class_name', 'ASC')
      .getRawMany<{ class_name: string }>();
    return rows.map((row) => row.class_name);
  }

  // 作用：校验学号是否可用，编辑时支持 excludeId 排除当前学员。

  async checkNo(studentNoRaw: string, excludeIdRaw: string) {
    const studentNo = normalizeText(studentNoRaw);
    const excludeId = normalizeText(excludeIdRaw);
    if (!studentNo) fail(400, '学号不能为空');
    const where = excludeId
      ? { student_no: studentNo, id: Not(Number(excludeId)) }
      : { student_no: studentNo };
    return { unique: !(await this.studentRepository.findOneBy(where)) };
  }

  // 作用：查询学员详情，并展开 enrolledCourses，方便前端详情页直接展示已选课程。

  async detail(id: string) {
    const studentId = parsePositiveIntId(id, '学生不存在');
    const student = await this.studentRepository.findOneBy({ id: studentId });
    if (!student) fail(404, '学生不存在');
    const courseIds = parseCourseIds(student.course_ids);
    const enrolledCourses = courseIds.length
      ? await this.courseRepository.findBy({ id: In(courseIds) })
      : [];
    return { ...student, course_ids: courseIds, enrolledCourses };
  }

  // 作用：创建学员并刷新课程 student_count，确保课程统计和学员选课关系同步。

  async create(body: Record<string, unknown>) {
    const payload = normalizeStudentPayload(body);
    if ('error' in payload) fail(400, payload.error);
    if (await this.studentRepository.findOneBy({ student_no: payload.student_no })) {
      fail(400, '学号已存在');
    }
    if ((await this.findInvalidCourseIds(payload.course_ids)).length > 0) fail(400, '所选课程不存在');

    const student = await this.studentRepository.save(this.studentRepository.create({
      ...payload,
      course_ids: JSON.stringify(payload.course_ids),
    }));
    await this.recalculateCourseStudentCounts();
    return this.detail(String(student.id));
  }

  // 作用：更新学员资料和选课关系，未传字段沿用原值，并同步刷新课程人数。

  async update(id: string, body: Record<string, unknown>) {
    const studentId = parsePositiveIntId(id, '学生不存在');
    const existing = await this.studentRepository.findOneBy({ id: studentId });
    if (!existing) fail(404, '学生不存在');
    const merged = {
      ...existing,
      ...body,
      course_ids: body.course_ids === undefined ? parseCourseIds(existing.course_ids) : body.course_ids,
    };
    const payload = normalizeStudentPayload(merged);
    if ('error' in payload) fail(400, payload.error);

    const duplicated = await this.studentRepository.findOneBy({ student_no: payload.student_no, id: Not(studentId) });
    if (duplicated) fail(400, '学号已存在');
    if ((await this.findInvalidCourseIds(payload.course_ids)).length > 0) fail(400, '所选课程不存在');

    await this.studentRepository.save({
      ...existing,
      ...payload,
      course_ids: JSON.stringify(payload.course_ids),
    });
    await this.recalculateCourseStudentCounts();
    return this.detail(id);
  }

  // 作用：删除学员后重算课程人数，避免课程列表统计残留脏数据。

  async delete(id: string) {
    const studentId = parsePositiveIntId(id, '学生不存在');
    const existing = await this.studentRepository.findOneBy({ id: studentId });
    if (!existing) fail(404, '学生不存在');
    await this.studentRepository.delete({ id: studentId });
    await this.recalculateCourseStudentCounts();
  }

  // 作用：找出前端提交的课程 ID 中不存在的项，用于阻止无效选课关系写入。

  private async findInvalidCourseIds(courseIds: number[]) {
    if (!courseIds.length) return [];
    const existing = await this.courseRepository.findBy({ id: In(courseIds) });
    const existingIds = new Set(existing.map((course) => course.id));
    return courseIds.filter((courseId) => !existingIds.has(courseId));
  }

  // 作用：按 students.course_ids 反算每门课的 student_count，保持课程看板统计准确。

  private async recalculateCourseStudentCounts() {
    const courses = await this.courseRepository.find({ select: ['id'] });
    const students = await this.studentRepository.find({ select: ['course_ids'] });
    const counts = new Map<number, number>(courses.map((course) => [course.id, 0]));
    for (const student of students) {
      for (const courseId of parseCourseIds(student.course_ids)) {
        counts.set(courseId, (counts.get(courseId) ?? 0) + 1);
      }
    }
    await this.dataSource.transaction(async (manager) => {
      for (const [courseId, count] of counts) {
        await manager.update(CourseEntity, { id: courseId }, { student_count: count });
      }
    });
  }
}

// 作用：统一把表单文本字段转为去首尾空格后的字符串。
function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

// 作用：兼容数组和 JSON 字符串两种 course_ids 形态，并去重为数字数组。
function parseCourseIds(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : JSON.parse(String(value || '[]'));
  const ids = raw.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0);
  return [...new Set<number>(ids)];
}

// 作用：校验前端提交的 course_ids 必须是数字数组，保持和 Koa 版写入契约一致。
function normalizeCourseIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// 作用：集中校验学员创建/编辑载荷，保证 service 主流程更清晰。
function normalizeStudentPayload(body: Record<string, unknown>): StudentPayload {
  const name = normalizeText(body.name);
  const studentNo = normalizeText(body.student_no);
  if (!name || !studentNo) return { error: '学生姓名和学号不能为空' } as const;
  if (!/^\d{8}$/.test(studentNo)) return { error: '学号格式应为 8 位数字' } as const;
  const phone = normalizeText(body.phone);
  const email = normalizeText(body.email);
  const status = normalizeText(body.status) || 'active';
  const courseIds = normalizeCourseIds(body.course_ids);
  if (courseIds === null) return { error: 'course_ids 必须是数字数组' } as const;
  if (!/^1[3-9]\d{9}$/.test(phone)) return { error: '手机号格式不正确' } as const;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '邮箱格式不正确' } as const;
  if (!['active', 'inactive'].includes(status)) return { error: '学生状态不合法' } as const;
  if (courseIds.length === 0) return { error: '请至少选择一门课程' } as const;

  return {
    name,
    student_no: studentNo,
    class_name: normalizeText(body.class_name),
    phone,
    email,
    status,
    course_ids: courseIds,
  };
}
