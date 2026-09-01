import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// 文件作用：映射 roles 表，保存系统内置角色和自定义角色的基础信息。
@Entity('roles')
export class RoleEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  editable: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  builtin: number;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  deletable: number;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updated_at: Date;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;
}
