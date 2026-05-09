/* 
模块：静态资源路由
接口：GET /api/static/:path
定位：安全读取 server/data 下的图片资源，用于 Markdown 引用
要点：目录穿越校验、类型白名单校验、404 处理
*/
import Router from '@koa/router';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname, resolve, normalize } from 'path';
import { fail } from '../utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_ROOT = resolve(__dirname, '../../data');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const router = new Router();

router.get('/(.*)', async (ctx) => {
  const reqPath = ctx.params[0];
  const filePath = normalize(join(DATA_ROOT, reqPath));

  // 路径必须仍然落在 DATA_ROOT 内，阻止 ../ 这类目录穿越访问服务器任意文件。
  if (!filePath.startsWith(DATA_ROOT)) {
    return fail(ctx, 400, '非法路径');
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext];
  // 只放行白名单图片类型，避免把这个接口变成任意文件下载口。
  if (!mime) {
    return fail(ctx, 403, '不支持的文件类型');
  }

  if (!existsSync(filePath)) {
    return fail(ctx, 404, '文件不存在');
  }

  ctx.type = mime;
  ctx.body = readFileSync(filePath);
});

export default router;
