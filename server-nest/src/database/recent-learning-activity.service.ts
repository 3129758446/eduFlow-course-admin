import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatLocalDate } from './date.util';
import { CourseEntity, LearningRecordEntity, StudentEntity } from './entities';

// 文件作用：维护近 7 天学习活跃度。数据库暂无真实行为表时，每天按现有逻辑补齐一次记录。
@Injectable()
export class RecentLearningActivityService implements OnModuleInit, OnModuleDestroy {
  private refreshTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepository: Repository<StudentEntity>,
    @InjectRepository(LearningRecordEntity)
    private readonly learningRecordRepository: Repository<LearningRecordEntity>,
  ) {}

  // 作用：启动时立即补齐一次，并注册每日刷新任务。
  async onModuleInit() {
    await this.refreshRecentLearningActivity();
    this.refreshTimer = setInterval(() => {
      void this.refreshRecentLearningActivity();
    }, 24 * 60 * 60 * 1000);
    this.refreshTimer.unref();
  }

  // 作用：应用关闭时清理定时器，避免测试或热重载时残留后台任务。
  onModuleDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  // 作用：返回近 7 天活跃图表数据，保持旧接口字段和自然日口径。
  async listRecentActivity() {
    await this.refreshRecentLearningActivity();
    const today = new Date();
    const activity: Array<{ date: string; label: string; students: number; duration: number }> = [];

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatLocalDate(date);
      const record = await this.learningRecordRepository
        .createQueryBuilder('record')
        .select('COUNT(DISTINCT record.student_id)', 'students')
        .addSelect('COALESCE(SUM(record.duration), 0)', 'duration')
        .where('record.date = :date', { date: dateStr })
        .getRawOne<{ students: number | string; duration: number | string }>();
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      activity.push({
        date: dateStr,
        label: weekDays[date.getDay()],
        students: Number(record?.students ?? 0),
        duration: Math.round(Number(record?.duration ?? 0) / 60),
      });
    }

    return activity;
  }

  // 作用：按自然日补齐近 7 天学习记录；某天已有记录时跳过，保证每天最多补一次。
  private async refreshRecentLearningActivity() {
    const students = await this.studentRepository.find({ select: ['id'] });
    const courses = await this.courseRepository.find({ select: ['id'] });
    if (!students.length || !courses.length) return;

    const today = new Date();
    for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOffset);
      const dateStr = formatLocalDate(date);
      const existing = await this.learningRecordRepository.countBy({ date: dateStr });
      if (existing > 0) continue;

      const recordCount = Math.floor(Math.random() * 10) + 5;
      const records = Array.from({ length: recordCount }, () => ({
        student_id: students[Math.floor(Math.random() * students.length)].id,
        course_id: courses[Math.floor(Math.random() * courses.length)].id,
        date: dateStr,
        duration: Math.floor(Math.random() * 90) + 10,
      }));
      await this.learningRecordRepository.insert(records);
    }
  }
}
