// 文件作用：权限业务服务，负责角色权限查询、自定义角色维护和角色-权限映射更新。
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { RoleEntity, RolePermissionEntity, UserEntity } from '../database/entities';
import {
  DEFAULT_ROLES,
  IMMUTABLE_ROLES,
  PERMISSION_DEPENDENCIES,
  PERMISSION_GROUPS,
  PERMISSIONS,
} from './permissions.constants';

const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS);
const CUSTOM_ROLE_PREFIX = 'custom_';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // 作用：归一化权限集合，自动补齐写权限依赖的查看权限。
  normalizePermissions(inputPermissions: string[] = []) {
    const result = new Set<string>();
    for (const permission of inputPermissions) {
      if (!ALL_PERMISSIONS.includes(permission)) continue;
      result.add(permission);
      for (const dependency of PERMISSION_DEPENDENCIES[permission] ?? []) {
        result.add(dependency);
      }
    }
    return [...result];
  }

  // 作用：校验前端提交的权限码是否都存在于后端白名单。
  validatePermissions(inputPermissions: string[] = []) {
    const invalid = inputPermissions.filter((permission) => !ALL_PERMISSIONS.includes(permission));
    return { valid: invalid.length === 0, invalid };
  }

  // 作用：根据角色 code 获取权限集合，admin 始终返回全部权限。

  async getPermissionsByRole(roleCode: string) {
    if (IMMUTABLE_ROLES.includes(roleCode)) return ALL_PERMISSIONS;
    const rows = await this.rolePermissionRepository.find({
      select: ['permission_code'],
      where: { role_code: roleCode },
      order: { permission_code: 'ASC' },
    });
    return rows.map((row) => row.permission_code);
  }

  // 作用：批量查询多个角色的权限，减少账号列表组装时的数据库往返。

  async getPermissionsByRoles(roleCodes: string[] = []) {
    const uniqueRoleCodes = [...new Set(roleCodes.filter(Boolean))];
    const permissionsByRole = new Map<string, string[]>();
    for (const roleCode of uniqueRoleCodes) {
      permissionsByRole.set(roleCode, IMMUTABLE_ROLES.includes(roleCode) ? [...ALL_PERMISSIONS] : []);
    }
    const editableRoleCodes = uniqueRoleCodes.filter((roleCode) => !IMMUTABLE_ROLES.includes(roleCode));
    if (!editableRoleCodes.length) return permissionsByRole;

    const rows = await this.rolePermissionRepository.find({
      select: ['role_code', 'permission_code'],
      where: { role_code: In(editableRoleCodes) },
      order: { role_code: 'ASC', permission_code: 'ASC' },
    });
    for (const row of rows) {
      permissionsByRole.get(row.role_code)?.push(row.permission_code);
    }
    return permissionsByRole;
  }

  // 作用：根据用户当前角色计算最终生效权限。

  async getEffectivePermissions(user?: { role?: string }) {
    return this.getPermissionsByRole(user?.role ?? '');
  }

  // 作用：返回权限分组字典，前端用于可视化权限配置。
  listPermissionGroups() {
    return PERMISSION_GROUPS;
  }

  // 作用：返回角色列表、用户数量和每个角色的权限集合。

  async listRoles() {
    const roles = (await this.roleRepository.find()).sort(compareRoles);
    const sourceRoles = roles.length ? roles : DEFAULT_ROLES.map((role) => ({
      ...role,
      editable: IMMUTABLE_ROLES.includes(role.code) ? 0 : 1,
      builtin: 1,
      deletable: 0,
    }));
    const roleCodes = sourceRoles.map((role) => role.code);
    const permissionsByRole = await this.getPermissionsByRoles(roleCodes);
    const userCountsByRole = await this.getUserCountsByRoles(roleCodes);

    return sourceRoles.map((role) => ({
      ...role,
      editable: Boolean(role.editable) && !IMMUTABLE_ROLES.includes(role.code),
      builtin: Boolean(role.builtin),
      deletable: Boolean(role.deletable) && !IMMUTABLE_ROLES.includes(role.code),
      userCount: userCountsByRole.get(role.code) ?? 0,
      permissions: permissionsByRole.get(role.code) ?? [],
    }));
  }

  // 作用：创建自定义角色，并初始化角色权限映射。

  async createRole({ name, description = '', permissions = [] }: { name?: string; description?: string; permissions?: string[] } = {}) {
    const normalizedName = this.normalizeRoleName(name);
    const validation = this.validatePermissions(permissions);
    if (!validation.valid) throw new Error(`权限码不存在: ${validation.invalid.join(', ')}`);

    const roleCode = await this.createUniqueRoleCode();
    await this.dataSource.transaction(async (manager) => {
      await manager.save(RoleEntity, {
        code: roleCode,
        name: normalizedName,
        description: String(description ?? '').trim(),
        editable: 1,
        builtin: 0,
        deletable: 1,
      });
      await this.replaceRolePermissions(roleCode, this.normalizePermissions(permissions), manager);
    });
    return this.getRoleByCode(roleCode);
  }

  // 作用：修改角色名称和描述，内置角色名称不允许被修改。

  async updateRoleInfo(roleCode: string, { name, description }: { name?: string; description?: string } = {}) {
    const role = await this.requireExistingRole(roleCode);
    const nextName = name === undefined ? role.name : this.normalizeRoleName(name);
    const nextDescription = description === undefined ? role.description : String(description ?? '').trim();
    if (role.builtin && nextName !== role.name) throw new Error('系统默认角色名称不可修改');

    await this.roleRepository.update({ code: roleCode }, { name: nextName, description: nextDescription });
    return this.getRoleByCode(roleCode);
  }

  // 作用：删除自定义角色，仍有关联用户或内置角色时拒绝删除。

  async deleteRole(roleCode: string) {
    const role = await this.requireExistingRole(roleCode);
    if (!role.deletable || role.builtin || IMMUTABLE_ROLES.includes(roleCode)) {
      throw new Error('系统默认角色不可删除');
    }
    const userCount = await this.countUsersByRole(roleCode);
    if (userCount > 0) throw new Error(`该角色下还有用户，请先转移 ${userCount} 个用户后再删除`);
    await this.roleRepository.delete({ code: roleCode });
  }

  // 作用：判断某个角色是否可分配给用户。

  async canAssignRole(roleCode: string) {
    if (IMMUTABLE_ROLES.includes(roleCode)) return false;
    const role = await this.roleRepository.findOneBy({ code: roleCode });
    return Boolean(role);
  }

  // 作用：保存角色权限集合，事务性替换 role_permissions 中的旧映射。

  async updateRolePermissions(roleCode: string, permissions: string[] = []) {
    if (IMMUTABLE_ROLES.includes(roleCode)) throw new Error('管理员权限不可修改');
    const role = await this.roleRepository.findOneBy({ code: roleCode });
    if (!role) throw new Error('角色不存在');
    if (!role.editable) throw new Error('该角色权限不可修改');

    const validation = this.validatePermissions(permissions);
    if (!validation.valid) throw new Error(`权限码不存在: ${validation.invalid.join(', ')}`);

    const normalized = this.normalizePermissions(permissions);
    await this.replaceRolePermissions(roleCode, normalized);
    return this.getPermissionsByRole(roleCode);
  }

  // 作用：通过角色 code 获取角色详情，供创建/更新后回显。

  private async getRoleByCode(roleCode: string) {
    const roles = await this.listRoles();
    return roles.find((role) => role.code === roleCode) ?? null;
  }

  // 作用：查询并校验角色存在，同时把数据库布尔字段转换为 boolean。

  private async requireExistingRole(roleCode: string) {
    const role = await this.roleRepository.findOneBy({ code: roleCode });
    if (!role) throw new Error('角色不存在');
    return {
      ...role,
      editable: Boolean(role.editable),
      builtin: Boolean(role.builtin),
      deletable: Boolean(role.deletable),
    };
  }

  // 作用：清洗并校验角色名称。

  private normalizeRoleName(name?: string) {
    const normalized = String(name ?? '').trim();
    if (!normalized) throw new Error('角色名称不能为空');
    if (normalized.length > 30) throw new Error('角色名称不能超过 30 个字符');
    return normalized;
  }

  // 作用：生成不会与现有角色冲突的自定义角色 code。

  private async createUniqueRoleCode() {
    for (let index = 0; index < 5; index += 1) {
      const code = `${CUSTOM_ROLE_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const exists = await this.roleRepository.findOneBy({ code });
      if (!exists) return code;
    }
    throw new Error('角色编码生成失败，请重试');
  }

  // 作用：统计某个角色下还有多少用户，用于删除角色前校验。

  private async countUsersByRole(roleCode: string) {
    return this.userRepository.countBy({ role: roleCode });
  }

  // 作用：批量统计角色用户数，供角色列表展示。

  private async getUserCountsByRoles(roleCodes: string[] = []) {
    const uniqueRoleCodes = [...new Set(roleCodes.filter(Boolean))];
    const userCountsByRole = new Map(uniqueRoleCodes.map((roleCode) => [roleCode, 0]));
    if (!uniqueRoleCodes.length) return userCountsByRole;
    const rows = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .where('user.role IN (:...roleCodes)', { roleCodes: uniqueRoleCodes })
      .groupBy('user.role')
      .getRawMany<{ role: string; count: number }>();
    for (const row of rows) userCountsByRole.set(row.role, Number(row.count));
    return userCountsByRole;
  }

  // 作用：事务性替换角色权限映射，保证权限保存要么全部成功，要么全部回滚。

  private async replaceRolePermissions(roleCode: string, permissions: string[], connection?: EntityManager) {
    const work = async (manager: EntityManager) => {
      await manager.delete(RolePermissionEntity, { role_code: roleCode });
      for (const permission of permissions) {
        await manager.insert(RolePermissionEntity, { role_code: roleCode, permission_code: permission });
      }
    };

    if (connection) {
      await work(connection);
      return;
    }
    await this.dataSource.transaction(work);
  }
}

function compareRoles(left: RoleEntity, right: RoleEntity) {
  const weight = (code: string) => {
    if (code === 'admin') return 1;
    if (code === 'teacher') return 2;
    if (code === 'student') return 3;
    if (code === 'custom') return 4;
    return 5;
  };
  return weight(left.code) - weight(right.code) || left.code.localeCompare(right.code);
}
