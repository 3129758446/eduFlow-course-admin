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

// Access Token 短期有效，泄露后的可利用窗口最多 15 分钟。
const ACCESS_TOKEN_TTL = '15m';
// Refresh Token 每次使用续期，但连续闲置超过 24 小时即失效。
const REFRESH_IDLE_MS = 24 * 60 * 60 * 1000;
// 无论是否持续使用，单个登录会话最长不超过 7 天。
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
    // 数据库仅保存摘要；原始 Refresh Token 只存在于 HttpOnly Cookie 中。
    const tokenHash = hashRefreshToken(refreshToken);
    const now = new Date();
    const nextRefreshToken = createRefreshToken();
    const nextTokenId = randomUUID();
    const refreshState: { result?: { userId: number; tokenId: string; refreshExpiresAt: Date } } = {};
    let replayedFamilyId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      // 行锁保证同一个旧 Token 只能被成功轮换一次，避免并发刷新产生多个有效后继令牌。
      const current = await manager.getRepository(RefreshTokenEntity)
        .createQueryBuilder('refreshToken')
        .setLock('pessimistic_write')
        .where('refreshToken.token_hash = :tokenHash', { tokenHash })
        .getOne();
      if (!current) return;

      if (current.status !== 'active') {
        // 已轮换或已撤销的令牌再次出现视为重放，撤销整条设备会话链。
        replayedFamilyId = current.family_id;
        await this.revokeFamily(manager, current.family_id, now);
        return;
      }

      if (current.idle_expires_at <= now || current.absolute_expires_at <= now) {
        await manager.update(RefreshTokenEntity, { id: current.id }, { status: 'revoked', revoked_at: now });
        return;
      }

      // 闲置续期不能突破创建时确定的 7 天最大会话期限。
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
      // 先写入后继令牌，再将旧令牌标记为已轮换，保留完整轮换链路。
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
    // 当前设备退出时撤销该 Refresh Token 家族，已签发的 Access Token 也会被 Guard 拒绝。
    await this.revokeFamily(this.dataSource.manager, token.family_id, new Date());
  }

  async logoutAll(userId: number) {
    // 用于“退出全部设备”和改密码：撤销用户的所有活跃会话。
    await this.dataSource.manager.update(RefreshTokenEntity, { user_id: userId, status: 'active' }, {
      status: 'revoked',
      revoked_at: new Date(),
    });
  }

  // 作用：根据已通过 Guard 验证的用户 ID 查询最新用户信息和权限。

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
    // 修改密码后撤销所有设备会话，防止旧凭据继续使用。
    await this.logoutAll(userId);
  }

  async isSessionActive(sessionId: string) {
    // Guard 的在线会话校验：令牌即使尚未过期，也必须关联活跃且未超时的会话。
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
    // 原始令牌只在本次响应中返回；数据库只持久化不可逆摘要。
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
        // sessionId 将短期 JWT 关联到服务端会话，以支持即时失效。
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
    // 一个轮换链对应一个设备会话；重放或退出时整链撤销。
    await manager.update(RefreshTokenEntity, { family_id: familyId, status: 'active' }, {
      status: 'revoked',
      revoked_at: now,
    });
  }
}

function createRefreshToken() {
  // 256 位随机值使用 URL 安全编码，适合直接写入 Cookie。
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(token: string) {
  // 泄露数据库时不能直接拿到可用的 Refresh Token。
  return createHash('sha256').update(token).digest('hex');
}
