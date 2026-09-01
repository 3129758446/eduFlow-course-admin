import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
} from './entities';
import {
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  PERMISSION_GROUPS,
} from '../permissions/permissions.constants';

// 文件作用：数据库启动初始化器。仅负责首次启动补齐系统默认角色、权限和默认账号。
@Injectable()
export class DatabaseInit implements OnModuleInit {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  // 作用：应用启动后初始化系统默认数据；不写入课程、学生、总结等业务演示数据。
  async onModuleInit() {
    await this.initSystemDefaults();
  }

  // 作用：按主键补齐内置角色、权限、角色权限关系和默认账号，不覆盖已有数据。
  private async initSystemDefaults() {
    for (const role of DEFAULT_ROLES) {
      const existing = await this.roleRepository.findOneBy({ code: role.code });
      if (existing) continue;
      await ignoreDuplicateKey(() => this.roleRepository.save(this.roleRepository.create({
        ...role,
        editable: role.code === 'admin' ? 0 : 1,
        builtin: 1,
        deletable: 0,
      })));
    }

    let sortOrder = 1;
    for (const group of PERMISSION_GROUPS) {
      for (const permission of group.permissions) {
        const existing = await this.permissionRepository.findOneBy({ code: permission.code });
        if (existing) {
          sortOrder += 1;
          continue;
        }
        await ignoreDuplicateKey(() => this.permissionRepository.save(this.permissionRepository.create({
          code: permission.code,
          name: permission.name,
          module: group.module,
          module_name: group.moduleName,
          sort_order: sortOrder,
        })));
        sortOrder += 1;
      }
    }

    for (const [roleCode, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const existingPermissionCount = await this.rolePermissionRepository.countBy({ role_code: roleCode });
      if (existingPermissionCount > 0) continue;
      for (const permission of permissions) {
        await ignoreDuplicateKey(() => this.rolePermissionRepository.insert({
          role_code: roleCode,
          permission_code: permission,
        }));
      }
    }

    const users = [
      this.createDefaultUser('admin', 'admin123', '管理员', 'admin'),
      this.createDefaultUser('teacher', '123456', '教师账号', 'teacher'),
      this.createDefaultUser('student', '123456', '学生账号', 'student'),
    ];
    for (const user of users) {
      const existing = await this.userRepository.findOneBy({ username: user.username });
      if (!existing) await ignoreDuplicateKey(() => this.userRepository.save(user));
    }
  }

  // 作用：创建默认登录账号，统一密码加密方式。
  private createDefaultUser(username: string, password: string, name: string, role: string) {
    return this.userRepository.create({
      username,
      password: bcrypt.hashSync(password, 10),
      name,
      role,
    });
  }

}

// 作用：多实例首次启动时，其他实例可能已插入同一条默认数据；重复键可忽略，真实错误继续抛出。
async function ignoreDuplicateKey(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

function isDuplicateKeyError(error: unknown) {
  const maybeError = error as { code?: string; errno?: number };
  return maybeError.code === 'ER_DUP_ENTRY' || maybeError.errno === 1062;
}
