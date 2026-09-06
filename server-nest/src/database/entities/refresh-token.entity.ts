import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('refresh_tokens')
@Index(['user_id', 'status'])
@Index(['family_id', 'status'])
export class RefreshTokenEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'int', name: 'user_id' })
  user_id: number;

  @Column({ type: 'varchar', length: 36, name: 'family_id' })
  family_id: string;

  @Column({ type: 'char', length: 64, name: 'token_hash', unique: true })
  token_hash: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: 'active' | 'rotated' | 'revoked';

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;

  @Column({ type: 'datetime', name: 'last_used_at', nullable: true })
  last_used_at: Date | null;

  @Column({ type: 'datetime', name: 'idle_expires_at' })
  idle_expires_at: Date;

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
