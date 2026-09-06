import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('refresh_tokens')
@Index(['user_id', 'status'])
@Index(['family_id', 'status'])
// Refresh Token 原文不入库，只保存摘要和会话生命周期信息。
export class RefreshTokenEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'int', name: 'user_id' })
  user_id: number;

  // 同一设备会话的轮换链；检测到重放时按家族整体撤销。
  @Column({ type: 'varchar', length: 36, name: 'family_id' })
  family_id: string;

  // 原始 Refresh Token 的 SHA-256 摘要，避免数据库泄露时令牌可直接使用。
  @Column({ type: 'char', length: 64, name: 'token_hash', unique: true })
  token_hash: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: 'active' | 'rotated' | 'revoked';

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;

  @Column({ type: 'datetime', name: 'last_used_at', nullable: true })
  last_used_at: Date | null;

  // 最后一次成功刷新后延长的闲置到期时间（最多 24 小时）。
  @Column({ type: 'datetime', name: 'idle_expires_at' })
  idle_expires_at: Date;

  // 创建会话时固定的最大到期时间（7 天），刷新不会延长。
  @Column({ type: 'datetime', name: 'absolute_expires_at' })
  absolute_expires_at: Date;

  @Column({ type: 'datetime', name: 'rotated_at', nullable: true })
  rotated_at: Date | null;

  @Column({ type: 'datetime', name: 'revoked_at', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 36, name: 'replaced_by_id', nullable: true })
  replaced_by_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}
