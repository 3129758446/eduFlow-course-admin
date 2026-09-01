import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseInit } from './database.init';
import { DATABASE_ENTITIES } from './entities';
import { RecentLearningActivityService } from './recent-learning-activity.service';
import { createTypeOrmOptions, initializeTypeOrmDataSource } from './typeorm.config';

// 文件作用：数据库模块入口，注册 TypeORM、实体仓库和启动初始化器。
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: createTypeOrmOptions,
      dataSourceFactory: initializeTypeOrmDataSource,
    }),
    TypeOrmModule.forFeature(DATABASE_ENTITIES),
  ],
  providers: [DatabaseInit, RecentLearningActivityService],
  exports: [TypeOrmModule, RecentLearningActivityService],
})
export class DatabaseModule {}
