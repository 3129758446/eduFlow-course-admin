// 文件作用：工作台业务服务，聚合课程、学员和学习记录统计数据。
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  // 作用：聚合首页统计卡片、课程状态分布和近 7 天学习活跃度图表数据。

  async getDashboard() {
    const totalCourses = await this.count('SELECT COUNT(*) as count FROM courses');
    const publishedCourses = await this.count("SELECT COUNT(*) as count FROM courses WHERE status = 'published'");
    const totalStudents = await this.count('SELECT COUNT(*) as count FROM students');
    const activeStudents = await this.count("SELECT COUNT(*) as count FROM students WHERE status = 'active'");
    const enrollment = await this.database.all(
      `
        SELECT c.name, c.student_count as value
        FROM courses c
        WHERE c.status = 'published'
        ORDER BY c.student_count DESC
        LIMIT 8
      `,
    );
    const activity = await this.getRecentActivity();
    const statusDist = [
      { name: '活跃学生', value: activeStudents },
      { name: '非活跃学生', value: totalStudents - activeStudents },
    ];
    const categoryDist = await this.database.all(
      `
        SELECT category as name, COUNT(*) as value FROM courses
        WHERE category != '' GROUP BY category ORDER BY value DESC
      `,
    );

    return {
      stats: { totalCourses, publishedCourses, totalStudents, activeStudents },
      charts: { enrollment, activity, statusDist, categoryDist },
    };
  }

  // 作用：统计单个 COUNT 查询，并统一转换 MySQL 返回的数值类型。

  private async count(sql: string) {
    const row = await this.database.get<{ count: number }>(sql);
    return Number(row?.count ?? 0);
  }

  // 作用：近 7 天活跃数据按自然日回溯，和旧 Koa 版本保持同一统计口径。

  private async getRecentActivity() {
    const today = new Date();
    const activity: unknown[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const record = await this.database.get<{ students: number; duration: number }>(
        `
          SELECT COUNT(DISTINCT student_id) as students, COALESCE(SUM(duration), 0) as duration
          FROM learning_records WHERE date = ?
        `,
        [dateStr],
      );
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
}
