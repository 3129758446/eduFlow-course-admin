import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// 文件作用：映射 users 表，保存登录账号、角色和头像等认证基础信息。
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, default: 'admin' })
  role: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  avatar: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;
}
