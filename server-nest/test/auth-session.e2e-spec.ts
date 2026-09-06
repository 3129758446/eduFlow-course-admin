import '../src/config/load-env';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation.pipe';

describe('authentication session security', () => {
  let app: INestApplication;
  const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
  const mysqlPort = Number(process.env.MYSQL_PORT || 3306);
  const mysqlUser = process.env.MYSQL_USER || 'root';
  const mysqlPassword = process.env.MYSQL_PASSWORD || '';
  const mysqlDatabase = `eduflow_auth_session_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'session-test-secret';
    process.env.SERVE_STATIC = 'false';
    process.env.COOKIE_SECURE = 'false';
    process.env.MYSQL_HOST = mysqlHost;
    process.env.MYSQL_PORT = String(mysqlPort);
    process.env.MYSQL_USER = mysqlUser;
    process.env.MYSQL_PASSWORD = mysqlPassword;
    process.env.MYSQL_DATABASE = mysqlDatabase;
    process.env.MYSQL_CONNECTION_LIMIT = '5';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    try {
      const connection = await mysql.createConnection({
        host: mysqlHost,
        port: mysqlPort,
        user: mysqlUser,
        password: mysqlPassword,
      });
      await connection.query(`DROP DATABASE IF EXISTS \`${mysqlDatabase}\``);
      await connection.end();
    } catch {
      // The setup error is already reported by the test that needs MySQL.
    }
  });

  it('issues a fifteen-minute access token and an HttpOnly refresh cookie on login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    const decoded = jwt.decode(response.body.data.token) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
    const refreshCookie = String(response.headers['set-cookie']);
    expect(refreshCookie).toContain('Path=/api/auth');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');
    expect(refreshCookie).not.toContain('Secure');
  });

  it('adds the Secure attribute when COOKIE_SECURE is explicitly enabled', async () => {
    process.env.COOKIE_SECURE = 'true';
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    process.env.COOKIE_SECURE = 'false';

    expect(String(response.headers['set-cookie'])).toContain('Secure');
  });

  it('rotates refresh tokens and revokes the active access token on logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const firstCookie = ((login.headers['set-cookie'] as unknown as string[])[0]).split(';')[0];

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    const secondCookie = ((refreshed.headers['set-cookie'] as unknown as string[])[0]).split(';')[0];
    expect(refreshed.body.data.token).not.toBe(login.body.data.token);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', secondCookie)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.data.token}`)
      .expect(401);
  });
});
