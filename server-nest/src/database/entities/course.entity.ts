import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// 文件作用：映射 courses 表，保存课程基础信息、发布状态和课程统计字段。
@Entity('courses')
export class CourseEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, default: '' })
  instructor: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  cover: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  category: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ type: 'int', name: 'student_count', default: 0 })
  student_count: number;

  @Column({ type: 'int', name: 'lesson_count', default: 0 })
  lesson_count: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updated_at: Date;
}
