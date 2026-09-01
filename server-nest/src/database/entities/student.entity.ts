import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// 文件作用：映射 students 表，保存学员基础信息和选课关系快照。
@Entity('students')
export class StudentEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  student_no: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  class_name: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  email: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  // 作用：保持和旧接口一致，使用 JSON 字符串保存学员选择的课程 id 数组。
  @Column({ type: 'text' })
  course_ids: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updated_at: Date;
}
