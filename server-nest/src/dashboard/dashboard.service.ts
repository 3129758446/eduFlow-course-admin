// 文件作用：工作台业务服务，聚合课程、学员和学习记录统计数据。
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseEntity, StudentEntity } from '../database/entities';
import { RecentLearningActivityService } from '../database/recent-learning-activity.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepository: Repository<StudentEntity>,
    private readonly recentLearningActivityService: RecentLearningActivityService,
  ) {}

  // 作用：聚合首页统计卡片、课程状态分布和近 7 天学习活跃度图表数据。

  async getDashboard() {
    const totalCourses = await this.courseRepository.count();
    const publishedCourses = await this.courseRepository.countBy({ status: 'published' });
    const totalStudents = await this.studentRepository.count();
    const activeStudents = await this.studentRepository.countBy({ status: 'active' });
    const enrollmentRows = await this.courseRepository
      .createQueryBuilder('course')
      .select('course.name', 'name')
      .addSelect('course.student_count', 'value')
      .where('course.status = :status', { status: 'published' })
      .orderBy('course.student_count', 'DESC')
      .limit(8)
      .getRawMany();
    const enrollment = enrollmentRows.map((row: { name: string; value: number | string }) => ({
      name: row.name,
      value: Number(row.value),
    }));
    const activity = await this.recentLearningActivityService.listRecentActivity();
    const statusDist = [
      { name: '活跃学生', value: activeStudents },
      { name: '非活跃学生', value: totalStudents - activeStudents },
    ];
    const categoryRows = await this.courseRepository
      .createQueryBuilder('course')
      .select('course.category', 'name')
      .addSelect('COUNT(*)', 'value')
      .where("course.category != ''")
      .groupBy('course.category')
      .orderBy('value', 'DESC')
      .getRawMany();
    const categoryDist = categoryRows.map((row: { name: string; value: number | string }) => ({
      name: row.name,
      value: Number(row.value),
    }));

    return {
      stats: { totalCourses, publishedCourses, totalStudents, activeStudents },
      charts: { enrollment, activity, statusDist, categoryDist },
    };
  }

}
