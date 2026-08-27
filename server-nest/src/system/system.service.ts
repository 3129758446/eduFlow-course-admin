// 文件作用：系统管理业务服务，维护后台账号、角色分配、自定义角色和权限配置。
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { fail } from '../common/api.exception';
import { DatabaseService } from '../database/database.service';
import { PermissionService } from '../permissions/permission.service';

const PUBLIC_USER_FIELDS = 'id, username, name, role, avatar, created_at';
const INITIAL_PASSWORD = '123456';

@Injectable()
export class SystemService {
  constructor(
    private readonly database: DatabaseService,
    private readonly permissionService: PermissionService,
  ) {}

  // 作用：返回账号管理页用户列表，并附带每个用户当前角色对应的最新权限集合。

  async listUsers() {
    const users = await this.database.all<{ role: string } & Record<string, unknown>>(
      `
        SELECT ${PUBLIC_USER_FIELDS}
        FROM users
        ORDER BY id ASC
      `,
    );
    const permissionsByRole = await this.permissionService.getPermissionsByRoles(users.map((user) => user.role));

    return users.map((user) => ({
      ...user,
      permissions: permissionsByRole.get(user.role) ?? [],
    }));
  }

  // 作用：修改用户角色；管理员账号不可被降权，避免系统失去最高权限入口。

  async updateUserRole(userId: number, role: string) {
    if (!Number.isInteger(userId) || userId <= 0) fail(400, '用户 ID 不合法');
    const targetUser = await this.database.get<{ id: number; role: string }>(
      'SELECT id, role FROM users WHERE id = ?',
      [userId],
    );
    if (!targetUser) fail(404, '用户不存在');
    if (targetUser.role === 'admin') fail(400, '管理员账号不可修改角色');
    if (!(await this.permissionService.canAssignRole(role))) fail(400, '角色不存在或不可分配');

    await this.database.run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    return this.findPublicUserById(userId);
  }

  // 作用：新增系统账号，沿用旧 Koa 默认初始密码 123456。

  async createUser(body: { username?: string; name?: string; role?: string }) {
    const username = String(body?.username ?? '').trim();
    const name = String(body?.name ?? '').trim();
    const role = String(body?.role ?? '').trim();
    if (!username || !name || !role) fail(400, '用户名、姓名和角色不能为空');
    if (!(await this.permissionService.canAssignRole(role))) fail(400, '角色不可分配');
    if (await this.database.get('SELECT id FROM users WHERE username = ?', [username])) fail(400, '用户名已存在');

    const result = await this.database.run(
      `
        INSERT INTO users (username, password, name, role)
        VALUES (?, ?, ?, ?)
      `,
      [username, bcrypt.hashSync(INITIAL_PASSWORD, 10), name, role],
    );

    return this.findPublicUserById(Number(result.insertId));
  }

  // 作用：删除账号；禁止删除自己和 admin，避免权限管理被误操作锁死。

  async deleteUser(userId: number, currentUserId: number) {
    if (!Number.isInteger(userId) || userId <= 0) fail(400, '用户 ID 不合法');
    if (userId === currentUserId) fail(400, '不能删除当前登录用户');
    const targetUser = await this.database.get<{ id: number; role: string }>(
      'SELECT id, role FROM users WHERE id = ?',
      [userId],
    );
    if (!targetUser) fail(404, '用户不存在');
    if (targetUser.role === 'admin') fail(400, '管理员账号不可删除');

    await this.database.run('DELETE FROM users WHERE id = ?', [userId]);
  }

  // 作用：返回权限管理页角色列表，实际组装逻辑由 PermissionService 统一维护。

  async listRoles() {
    return this.permissionService.listRoles();
  }

  // 作用：新增自定义角色，并保存角色-权限码映射。

  async createRole(body: { name?: string; description?: string; permissions?: string[] }) {
    return this.permissionService.createRole({
      name: body?.name,
      description: body?.description,
      permissions: Array.isArray(body?.permissions) ? body.permissions : [],
    });
  }

  // 作用：修改角色基础信息，如名称和描述。

  async updateRoleInfo(code: string, body: { name?: string; description?: string }) {
    return this.permissionService.updateRoleInfo(String(code ?? '').trim(), {
      name: body?.name,
      description: body?.description,
    });
  }

  // 作用：删除可删除的自定义角色，内置角色由 PermissionService 拦截。

  async deleteRole(code: string) {
    await this.permissionService.deleteRole(String(code ?? '').trim());
  }

  // 作用：返回权限分组字典，前端用它渲染可视化权限配置树。
  listPermissionGroups() {
    return this.permissionService.listPermissionGroups();
  }

  // 作用：保存某个角色的权限集合；写入后下次接口请求会按新权限即时生效。

  async updateRolePermissions(code: string, permissions?: string[]) {
    if (!Array.isArray(permissions)) fail(400, 'permissions 必须是数组');
    const roleCode = String(code ?? '').trim();
    await this.permissionService.updateRolePermissions(roleCode, permissions);
    return (await this.permissionService.listRoles()).find((role) => role.code === roleCode);
  }

  // 作用：按 ID 查询脱敏用户信息，并补齐当前角色权限。

  private async findPublicUserById(id: number) {
    const user = await this.database.get<Record<string, unknown>>(
      `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ?`,
      [id],
    );
    return user ? { ...user, permissions: await this.permissionService.getEffectivePermissions(user as { role: string }) } : null;
  }
}
