// 文件作用：复用分页查询 DTO，负责把 page/pageSize 从 query string 转成数字并限制合理范围。
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

function toOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' && ['null', 'undefined'].includes(value.trim().toLowerCase())) {
    return undefined;
  }

  return Number(value);
}

export class PaginationQueryDto {
  @IsOptional()
  // 作用：空分页值沿用旧接口默认分页；真实非空值再转数字交给 IsInt/Min 校验。
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt({ message: '分页参数不合法' })
  @Min(1, { message: '分页参数不合法' })
  page?: number;

  @IsOptional()
  // 作用：兼容 pageSize=undefined 这类历史空值，同时限制真实数字范围。
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt({ message: '分页参数不合法' })
  @Min(1, { message: '分页参数不合法' })
  @Max(100, { message: '分页参数不合法' })
  pageSize?: number;
}
