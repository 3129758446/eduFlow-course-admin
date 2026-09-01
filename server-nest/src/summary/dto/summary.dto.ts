// 文件作用：学习总结模块请求 DTO，约束列表查询、新增和编辑入参。
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TrimString } from '../../common/dto/string-transform';

export class SummaryListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @TrimString()
  @IsString({ message: '关键词不合法' })
  keyword?: string;
}

export class CreateSummaryDto {
  @TrimString()
  @IsString({ message: '标题不能为空' })
  @IsNotEmpty({ message: '标题不能为空' })
  title!: string;

  @TrimString()
  @IsString({ message: '内容不能为空' })
  @IsNotEmpty({ message: '内容不能为空' })
  content!: string;
}

export class UpdateSummaryDto {
  @IsOptional()
  @TrimString()
  @IsString({ message: '标题不能为空' })
  @IsNotEmpty({ message: '标题不能为空' })
  title?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '内容不能为空' })
  @IsNotEmpty({ message: '内容不能为空' })
  content?: string;
}
