/* 
模块：学习总结路由
接口：GET /api/summary（需鉴权）
定位：读取服务端 data/summary.md 返回给前端渲染
*/
import Router from '@koa/router';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authenticateToken } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = new Router();

router.get('/', authenticateToken, async (ctx) => {
  try {
    const mdPath = join(__dirname, '../../data/summary.md');
    // 总结内容直接按文本读取，交给前端的 MarkdownRenderer 做解析和展示。
    const content = readFileSync(mdPath, 'utf-8');
    success(ctx, { content });
  } catch {
    fail(ctx, 500, '读取学习总结失败');
  }
});

export default router;
