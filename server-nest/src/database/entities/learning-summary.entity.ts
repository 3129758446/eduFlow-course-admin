import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { UserEntity } from './user.entity';

// 文件作用：映射 learning_summaries 表，保存用户提交的学习总结内容。
@Entity('learning_summaries')
export class LearningSummaryEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  user_id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updated_at: Date;

  // 作用：学习总结归属用户；用户删除后对应总结自动删除。
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}
