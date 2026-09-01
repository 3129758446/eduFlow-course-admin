// 文件作用：认证业务服务，负责账号密码登录、JWT 签发、当前用户查询和密码修改。
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { fail } from '../common/api.exception';
import { UserEntity } from '../database/entities';
import { PermissionService } from '../permissions/permission.service';
import { JWT_SECRET } from './auth.guard';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly permissionService: PermissionService,
  ) {}

  // 作用：完成账号密码登录，签发 JWT，并返回前端初始化菜单/路由/按钮所需的权限集合。

  async login(body: LoginDto) {
    const { username, password } = body;
    if (!username || !password) fail(400, '请输入用户名和密码');

    const user = await this.userRepository.findOneBy({ username });
    if (!user) fail(401, '用户名或密码错误');
    if (!bcrypt.compareSync(password, String(user.password))) fail(401, '用户名或密码错误');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET || JWT_SECRET,
      { expiresIn: '7d' },
    );
    const { password: _, ...userInfo } = user;

    return {
      token,
      user: {
        ...userInfo,
        permissions: await this.permissionService.getEffectivePermissions(userInfo as { role: string }),
      },
    };
  }

  // 作用：前端刷新页面时用 token 换取当前用户信息，并重新计算数据库中的最新权限。

  async getCurrentUser(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) fail(404, '用户不存在');
    const { password: _, ...userInfo } = user;
    return {
      ...userInfo,
      permissions: await this.permissionService.getEffectivePermissions(userInfo),
    };
  }

  // 作用：只允许当前登录用户修改自己的密码，避免通过传入 userId 越权改密。

  async changePassword(userId: number, body: ChangePasswordDto) {
    const oldPassword = String(body?.oldPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');
    if (!oldPassword || !newPassword) fail(400, '原密码和新密码不能为空');
    if (newPassword.length < 6) fail(400, '新密码至少需要 6 位');

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) fail(404, '用户不存在');
    if (!bcrypt.compareSync(oldPassword, user.password)) fail(400, '原密码不正确');

    await this.userRepository.update({ id: user.id }, { password: bcrypt.hashSync(newPassword, 10) });
  }
}
