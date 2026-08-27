// 文件作用：数据库模块，向业务模块提供共享的 DatabaseService。
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({
  // 作用：数据库模块，向所有业务模块提供单例 SQLite 连接。
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
