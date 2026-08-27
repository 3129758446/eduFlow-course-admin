// 文件作用：静态资源服务，按安全路径读取上传文件并写入 Express 响应。
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fail } from '../common/api.exception';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

@Injectable()
export class StaticService {
  // 作用：从 data 目录安全读取图片文件，服务学习总结中上传后的图片访问。
  sendDataFile(reqPath: string, res: Response) {
    const relativePath = reqPath.replace(/^\/api\/static\/?/, '');
    const dataRoot = resolve(process.env.DATA_ROOT || '../server/data');
    const filePath = resolve(dataRoot, relativePath);
    if (!filePath.startsWith(dataRoot)) fail(400, '非法路径');

    const ext = extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) fail(403, '不支持的文件类型');
    if (!existsSync(filePath)) fail(404, '文件不存在');

    res.type(mime);
    createReadStream(filePath).pipe(res);
  }
}
