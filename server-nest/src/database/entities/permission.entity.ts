import { Column, Entity, PrimaryColumn } from 'typeorm';

// 文件作用：映射 permissions 表，保存权限字典，供权限管理页面和接口鉴权使用。
@Entity('permissions')
export class PermissionEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  module: string;

  @Column({ type: 'varchar', length: 100, name: 'module_name' })
  module_name: string;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sort_order: number;
}
