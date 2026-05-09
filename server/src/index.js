/* 
模块：Koa 服务入口
定位：注册中间件/路由，初始化 SQLite，并静态托管 client/dist
数据流：/api/* -> 各业务路由；非 /api 的 GET 根据路径回落到 dist/index.html 以支持前端路由
用法：npm run dev 启动；前端通过 Vite 代理到 3000 端口
*/
import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { createReadStream, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, extname, join } from 'path';
import { initDatabase } from './database/init.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import courseRoutes from './routes/courses.js';
import studentRoutes from './routes/students.js';
import summaryRoutes from './routes/summary.js';
import staticRoutes from './routes/static.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST_ROOT = join(__dirname, '../../client/dist');

const MIME_TYPES = {
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

const app = new Koa();
const router = new Router();

initDatabase();

app.use(cors({ credentials: true }));
app.use(bodyParser());

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    // 兜底错误处理：把未捕获异常统一转成约定的 JSON 响应结构。
    const status = err.status || 500;
    ctx.status = status;
    ctx.body = { code: status, msg: err.message || '服务器内部错误', data: null };
    console.error(`[${new Date().toISOString()}] ${err.message}`);
  }
});

router.use('/api/auth', authRoutes.routes());
router.use('/api/dashboard', dashboardRoutes.routes());
router.use('/api/courses', courseRoutes.routes());
router.use('/api/students', studentRoutes.routes());
router.use('/api/summary', summaryRoutes.routes());
router.use('/api/static', staticRoutes.routes());

app.use(router.routes());
app.use(router.allowedMethods());

app.use(async (ctx, next) => {
  // 这里只处理前端静态资源和 SPA 路由回退，API 请求继续走业务路由。
  if (ctx.method !== 'GET' || ctx.path.startsWith('/api')) {
    await next();
    return;
  }

  const requestedPath = ctx.path === '/' ? 'index.html' : ctx.path.slice(1);
  const filePath = join(DIST_ROOT, requestedPath);
  // 如果请求的静态资源不存在，则回退到 index.html，让前端路由自己接管。
  const targetPath = existsSync(filePath) ? filePath : join(DIST_ROOT, 'index.html');
  const ext = extname(targetPath).toLowerCase();

  if (!existsSync(targetPath)) {
    await next();
    return;
  }

  ctx.type = MIME_TYPES[ext] || 'application/octet-stream';
  ctx.body = createReadStream(targetPath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务端已启动: http://localhost:${PORT}`);
});
