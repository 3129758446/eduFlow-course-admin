// 文件作用：上传业务服务，解析 multipart 图片并落盘到可静态访问的上传目录。
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fail } from '../common/api.exception';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Injectable()
export class UploadService {
  // 作用：保存学习总结图片，并返回前端 Markdown 可直接使用的静态访问 URL。
  async uploadSummaryImage(req: Request, userId: number) {
    const upload = await parseMultipartImage(req);
    if ('error' in upload) fail(upload.status, upload.error);

    const dataRoot = resolve(process.env.DATA_ROOT || '../server/data');
    const uploadDir = join(dataRoot, 'uploads', 'summary', String(userId));
    mkdirSync(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}${IMAGE_TYPES[upload.mime]}`;
    const filePath = join(uploadDir, filename);
    writeFileSync(filePath, upload.buffer);

    return { url: `/api/static/uploads/summary/${userId}/${filename}`, filename };
  }
}

// 作用：从原始 multipart/form-data 请求体中提取图片文件，保持和旧 Koa 上传接口兼容。

async function parseMultipartImage(req: Request) {
  const contentType = req.headers['content-type'];
  const boundary = String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1]
    ?? String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!String(contentType).includes('multipart/form-data') || !boundary) {
    return { status: 400, error: '请上传图片文件' } as const;
  }

  const body = await readRequestBody(req);
  if (body.length > MAX_UPLOAD_SIZE) return { status: 400, error: '图片大小不能超过 5MB' } as const;

  const file = extractFilePart(body, boundary);
  if (!file) return { status: 400, error: '未找到图片文件' } as const;
  if (!IMAGE_TYPES[file.mime]) return { status: 400, error: '仅支持 png、jpg、jpeg、webp、gif 图片' } as const;
  if (!file.buffer.length) return { status: 400, error: '图片内容不能为空' } as const;
  return file;
}

// 作用：读取没有经过 bodyParser 处理的上传流。
function readRequestBody(req: Request) {
  return new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 作用：根据 multipart boundary 拆出文件段，并解析 Content-Type 与二进制内容。
function extractFilePart(body: Buffer, boundary: string) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(body, boundaryBuffer);
  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const header = part.subarray(0, headerEnd).toString('utf8');
    if (!header.includes('filename=')) continue;

    const mime = header.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() || '';
    let buffer = part.subarray(headerEnd + 4);
    if (buffer.subarray(0, 2).toString() === '\r\n') buffer = buffer.subarray(2);
    if (buffer.subarray(-2).toString() === '\r\n') buffer = buffer.subarray(0, -2);
    return { mime, buffer };
  }
  return null;
}

// 作用：用 Buffer 边界分片，避免把图片二进制内容转字符串造成文件损坏。
function splitBuffer(buffer: Buffer, separator: Buffer) {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);
  while (index !== -1) {
    if (index > start) parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }
  if (start < buffer.length) parts.push(buffer.subarray(start));
  return parts;
}
