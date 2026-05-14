/*
模块：文件上传路由
定位：为学习总结 Markdown 提供图片上传能力，返回可被 /api/static 访问的图片地址
安全：只允许登录用户上传常见图片类型，限制文件大小，并使用随机文件名避免覆盖与路径注入
*/
import Router from '@koa/router';
import { mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../permissions.js';
import { success, fail } from '../utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_ROOT = resolve(__dirname, '../../data');
const SUMMARY_UPLOAD_DIR = resolve(DATA_ROOT, 'uploads/summary');
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const router = new Router();

// POST /api/upload/summary-image - 上传学习总结图片，返回可访问的 URL
router.post('/summary-image', authenticateToken, requirePermission(PERMISSIONS.SUMMARY_CREATE), async (ctx) => {
  const upload = await parseMultipartImage(ctx);
  if (upload.error) {
    return fail(ctx, upload.status, upload.error);
  }

  const userDir = join(SUMMARY_UPLOAD_DIR, String(ctx.state.user.id));
  mkdirSync(userDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${IMAGE_TYPES[upload.mime]}`;
  const filePath = join(userDir, filename);
  writeFileSync(filePath, upload.buffer);

  success(ctx, {
    url: `/api/static/uploads/summary/${ctx.state.user.id}/${filename}`,
    filename,
  });
});

// 辅助函数：解析 multipart/form-data 请求，提取名为 "file" 的图片文件，返回其 MIME 类型和内容 Buffer，或错误信息
async function parseMultipartImage(ctx) {
  const contentType = ctx.get('content-type');
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1]
    ?? contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];

  if (!contentType.includes('multipart/form-data') || !boundary) {
    return { status: 400, error: '请使用 multipart/form-data 上传图片' };
  }

  const body = await readRequestBody(ctx.req, MAX_IMAGE_SIZE);
  if (body.error) {
    return body;
  }

  const file = extractFilePart(body.buffer, boundary);
  if (!file) {
    return { status: 400, error: '未找到图片文件' };
  }
  if (!IMAGE_TYPES[file.mime]) {
    return { status: 400, error: '仅支持 png、jpg、jpeg、webp、gif 图片' };
  }
  if (!file.buffer.length) {
    return { status: 400, error: '图片内容不能为空' };
  }

  return file;
}

// 辅助函数：读取请求体数据，限制最大大小，返回 Buffer 或错误信息
function readRequestBody(stream, maxSize) {
  return new Promise((resolveResult) => {
    const chunks = [];
    let size = 0;

    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        stream.destroy();
        resolveResult({ status: 413, error: '图片不能超过 5MB' });
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => {
      resolveResult({ buffer: Buffer.concat(chunks) });
    });
    stream.on('error', () => {
      resolveResult({ status: 400, error: '图片上传失败' });
    });
  });
}

// 辅助函数：从 multipart/form-data 的请求体中提取名为 "file" 的文件部分，返回其 MIME 类型和内容 Buffer
function extractFilePart(body, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(body, boundaryBuffer);

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd < 0) continue;

    const headers = part.subarray(0, headerEnd).toString('utf8');
    if (!/name="file"/.test(headers) || !/filename="/.test(headers)) continue;

    const mime = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() ?? '';
    let content = part.subarray(headerEnd + 4);
    if (content.subarray(0, 2).toString() === '\r\n') {
      content = content.subarray(2);
    }
    if (content.subarray(-2).toString() === '\r\n') {
      content = content.subarray(0, -2);
    }

    return { mime, buffer: content };
  }

  return null;
}

// 辅助函数：根据分隔符切分 Buffer，返回所有部分的数组
function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    if (index > start) {
      parts.push(buffer.subarray(start, index));
    }
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  if (start < buffer.length) {
    parts.push(buffer.subarray(start));
  }

  return parts;
}

export default router;
