// 文件作用：复用分页查询 DTO，负责把 page/pageSize 从 query string 转成数字并限制合理范围。
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  // 作用：空字符串沿用旧接口默认分页；非空值再转成数字交给 IsInt 校验。
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsInt({ message: '分页参数不合法' })
  @Min(1, { message: '分页参数不合法' })
  page?: number;

  @IsOptional()
  // 作用：避免 pageSize= 这类旧请求被误判为非法，同时限制真实数字范围。
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsInt({ message: '分页参数不合法' })
  @Min(1, { message: '分页参数不合法' })
  @Max(100, { message: '分页参数不合法' })
  pageSize?: number;
}
