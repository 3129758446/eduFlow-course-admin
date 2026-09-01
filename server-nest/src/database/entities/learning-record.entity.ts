import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CourseEntity } from './course.entity';
import { StudentEntity } from './student.entity';

// 文件作用：映射 learning_records 表，保存每日学习时长，用于工作台近 7 天活跃度统计。
@Entity('learning_records')
export class LearningRecordEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', name: 'student_id', nullable: true })
  student_id: number | null;

  @Column({ type: 'int', name: 'course_id', nullable: true })
  course_id: number | null;

  @Column({ type: 'varchar', length: 20 })
  date: string;

  @Column({ type: 'int', default: 0 })
  duration: number;

  // 作用：学习记录关联学员；学员删除后对应学习记录自动删除。
  @ManyToOne(() => StudentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  // 作用：学习记录关联课程；课程删除后对应学习记录自动删除。
  @ManyToOne(() => CourseEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseEntity;
}
