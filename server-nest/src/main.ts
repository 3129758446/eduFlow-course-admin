// 文件作用：NestJS 应用启动入口，注册全局前缀、跨域、静态资源、异常过滤器并监听端口。
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { existsSync, createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { createValidationPipe } from './common/validation.pipe';

const CLIENT_DIST_ROOT = resolve(process.env.CLIENT_DIST_ROOT || join(process.cwd(), '../client/dist'));
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// 作用：创建 Nest 应用、注册全局兼容配置，并启动 HTTP 服务。

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 前端 Axios 使用 /api 相对路径，本地调试和 Docker 代理场景都保留跨域凭证兼容。
  app.enableCors({ credentials: true });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(createValidationPipe());

  if (process.env.SERVE_STATIC !== 'false') {
    // 本地开发可由 NestJS 兼容旧 Koa 的 client/dist 静态托管；Docker 中默认交给 Nginx，所以可用环境变量关闭。
    const adapter = app.getHttpAdapter().getInstance();
    // 兼容旧 Koa 的前端静态托管逻辑，API 以外的 GET 请求交给 client/dist。
    adapter.get('*', (req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      const requestedPath = req.path === '/' ? 'index.html' : req.path.slice(1);
      const filePath = join(CLIENT_DIST_ROOT, requestedPath);
      // 未命中真实静态文件时回落到 index.html，让 React Router 接管 /dashboard 等前端路由。
      const targetPath = existsSync(filePath) ? filePath : join(CLIENT_DIST_ROOT, 'index.html');
      if (!existsSync(targetPath)) {
        next();
        return;
      }
      const ext = extname(targetPath).toLowerCase();
      res.type(MIME_TYPES[ext] || 'application/octet-stream');
      createReadStream(targetPath).pipe(res);
    });
  }

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`NestJS 服务端已启动: http://localhost:${port}`);
}

bootstrap();
