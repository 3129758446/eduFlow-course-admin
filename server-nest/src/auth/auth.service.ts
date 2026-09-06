// 文件作用：认证业务服务，负责账号密码登录、JWT 签发、当前用户查询和密码修改。
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm';
import { fail } from '../common/api.exception';
import { RefreshTokenEntity, UserEntity } from '../database/entities';
import { PermissionService } from '../permissions/permission.service';
import { JWT_SECRET } from './auth.guard';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_IDLE_MS = 24 * 60 * 60 * 1000;
const REFRESH_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionResult = {
  token: string;
  user: Omit<UserEntity, 'password'> & { permissions: string[] };
  refreshToken: string;
  refreshExpiresAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly permissionService: PermissionService,
    private readonly dataSource: DataSource,
  ) {}

  // 作用：完成账号密码登录，签发 JWT，并返回前端初始化菜单/路由/按钮所需的权限集合。

  async login(body: LoginDto) {
    const { username, password } = body;
    if (!username || !password) fail(400, '请输入用户名和密码');

    const user = await this.userRepository.findOneBy({ username });
    if (!user) fail(401, '用户名或密码错误');
    if (!bcrypt.compareSync(password, String(user.password))) fail(401, '用户名或密码错误');

    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<SessionResult> {
    const tokenHash = hashRefreshToken(refreshToken);
    const now = new Date();
    const nextRefreshToken = createRefreshToken();
    const nextTokenId = randomUUID();
    const refreshState: { result?: { userId: number; tokenId: string; refreshExpiresAt: Date } } = {};
    let replayedFamilyId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      const current = await manager.getRepository(RefreshTokenEntity)
        .createQueryBuilder('refreshToken')
        .setLock('pessimistic_write')
        .where('refreshToken.token_hash = :tokenHash', { tokenHash })
        .getOne();
      if (!current) return;

      if (current.status !== 'active') {
        replayedFamilyId = current.family_id;
        await this.revokeFamily(manager, current.family_id, now);
        return;
      }

      if (current.idle_expires_at <= now || current.absolute_expires_at <= now) {
        await manager.update(RefreshTokenEntity, { id: current.id }, { status: 'revoked', revoked_at: now });
        return;
      }

      const nextIdleExpiry = new Date(Math.min(now.getTime() + REFRESH_IDLE_MS, current.absolute_expires_at.getTime()));
      const next = manager.create(RefreshTokenEntity, {
        id: nextTokenId,
        user_id: current.user_id,
        family_id: current.family_id,
        token_hash: hashRefreshToken(nextRefreshToken),
        status: 'active',
        last_used_at: now,
        idle_expires_at: nextIdleExpiry,
        absolute_expires_at: current.absolute_expires_at,
        rotated_at: null,
        revoked_at: null,
        replaced_by_id: null,
      });
      await manager.save(next);
      await manager.update(RefreshTokenEntity, { id: current.id }, {
        status: 'rotated',
        last_used_at: now,
        rotated_at: now,
        replaced_by_id: nextTokenId,
      });
      refreshState.result = { userId: current.user_id, tokenId: nextTokenId, refreshExpiresAt: nextIdleExpiry };
    });

    if (replayedFamilyId) fail(401, '登录会话已失效，请重新登录');
    const result = refreshState.result;
    if (!result) fail(401, '刷新令牌无效或已过期');
    const user = await this.userRepository.findOneBy({ id: result.userId });
    if (!user) fail(401, '用户不存在');
    return this.buildSessionResult(user, result.tokenId, nextRefreshToken, result.refreshExpiresAt);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const token = await this.refreshTokenRepository.findOneBy({ token_hash: hashRefreshToken(refreshToken) });
    if (!token) return;
    await this.revokeFamily(this.dataSource.manager, token.family_id, new Date());
  }

  async logoutAll(userId: number) {
    await this.dataSource.manager.update(RefreshTokenEntity, { user_id: userId, status: 'active' }, {
      status: 'revoked',
      revoked_at: new Date(),
    });
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
    await this.logoutAll(userId);
  }

  async isSessionActive(sessionId: string) {
    return this.refreshTokenRepository.exist({
      where: {
        id: sessionId,
        status: 'active',
        idle_expires_at: MoreThan(new Date()),
        absolute_expires_at: MoreThan(new Date()),
      },
    });
  }

  private async createSession(user: UserEntity): Promise<SessionResult> {
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_IDLE_MS);
    const refreshToken = createRefreshToken();
    const tokenId = randomUUID();
    await this.refreshTokenRepository.save(this.refreshTokenRepository.create({
      id: tokenId,
      user_id: user.id,
      family_id: randomUUID(),
      token_hash: hashRefreshToken(refreshToken),
      status: 'active',
      last_used_at: now,
      idle_expires_at: refreshExpiresAt,
      absolute_expires_at: new Date(now.getTime() + REFRESH_ABSOLUTE_MS),
      rotated_at: null,
      revoked_at: null,
      replaced_by_id: null,
    }));
    return this.buildSessionResult(user, tokenId, refreshToken, refreshExpiresAt);
  }

  private async buildSessionResult(user: UserEntity, sessionId: string, refreshToken: string, refreshExpiresAt: Date): Promise<SessionResult> {
    const { password: _, ...userInfo } = user;
    return {
      token: jwt.sign(
        { id: user.id, username: user.username, role: user.role, name: user.name, sessionId, type: 'access' },
        process.env.JWT_SECRET || JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL },
      ),
      user: {
        ...userInfo,
        permissions: await this.permissionService.getEffectivePermissions(userInfo),
      },
      refreshToken,
      refreshExpiresAt,
    };
  }

  private async revokeFamily(manager: EntityManager, familyId: string, now: Date) {
    await manager.update(RefreshTokenEntity, { family_id: familyId, status: 'active' }, {
      status: 'revoked',
      revoked_at: now,
    });
  }
}

function createRefreshToken() {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
