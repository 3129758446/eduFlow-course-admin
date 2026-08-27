// 文件作用：静态资源模块，装配 StaticService 和接口控制器。
import { Module } from '@nestjs/common';
import { StaticController } from './static.controller';
import { StaticService } from './static.service';

@Module({
  // 作用：静态资源模块，专门提供上传图片的安全访问能力。
  controllers: [StaticController],
  providers: [StaticService],
})
export class StaticModule {}
