import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';

// 文件作用：映射 role_permissions 表，保存角色和权限的多对多关系。
@Entity('role_permissions')
export class RolePermissionEntity {
  // 作用：role_code + permission_code 组成联合主键，避免同一角色重复绑定同一权限。
  @PrimaryColumn({ type: 'varchar', length: 100, name: 'role_code' })
  role_code: string;

  @PrimaryColumn({ type: 'varchar', length: 100, name: 'permission_code' })
  permission_code: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_code' })
  role?: RoleEntity;

  @ManyToOne(() => PermissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_code' })
  permission?: PermissionEntity;
}
