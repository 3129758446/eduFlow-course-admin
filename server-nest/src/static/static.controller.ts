// 文件作用：静态资源控制器，兼容旧接口的 /api/static/* 图片访问路径。
import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { StaticService } from './static.service';

@Controller('api/static')
export class StaticController {
  constructor(private readonly staticService: StaticService) {}

  // 作用：读取上传后的静态图片文件，用于学习总结图片回显。

  @Get('*')
  @Header('Cache-Control', 'public, max-age=31536000')
  staticFile(@Req() req: Request, @Res() res: Response) {
    const reqPath = req.path.replace(/^\/api\/static\/?/, '');
    return this.staticService.sendDataFile(reqPath, res);
  }
}
