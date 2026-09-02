import { randomUUID } from 'node:crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// 文件作用：映射 course_categories 表，保存课程分类字典数据。
@Entity('course_categories')
export class CourseCategoryEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'int', name: 'course_count', default: 0 })
  course_count: number;

  // 用微秒精度承载“最新新增在前”，避免同一秒内连续新增时排序不稳定。
  @CreateDateColumn({ type: 'datetime', precision: 6, name: 'created_at' })
  created_at: Date;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }
}
