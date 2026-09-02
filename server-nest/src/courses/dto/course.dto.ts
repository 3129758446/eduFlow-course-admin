// 文件作用：课程模块请求 DTO，约束课程列表查询、新增和编辑入参。
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TrimString } from '../../common/dto/string-transform';

const COURSE_STATUS = ['draft', 'published'] as const;
const COURSE_SORT_FIELDS = ['student_count', 'lesson_count', 'created_at', 'name'] as const;
const SORT_ORDERS = ['ascend', 'descend'] as const;

export class CourseListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @TrimString()
  @IsString({ message: '关键词不合法' })
  keyword?: string;

  @IsOptional()
  @TrimString()
  @IsIn(COURSE_STATUS, { message: '课程状态不合法' })
  status?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '课程分类不合法' })
  category?: string;

  @IsOptional()
  @TrimString()
  @IsUUID('all', { message: '课程分类不合法' })
  categoryId?: string;

  @IsOptional()
  @TrimString()
  @IsIn(COURSE_SORT_FIELDS, { message: '排序字段不合法' })
  sortField?: string;

  @IsOptional()
  @TrimString()
  @IsIn(SORT_ORDERS, { message: '排序方向不合法' })
  sortOrder?: string;
}

export class CreateCourseDto {
  @TrimString()
  @IsString({ message: '课程名称不能为空' })
  @IsNotEmpty({ message: '课程名称不能为空' })
  name!: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '课程描述不合法' })
  description?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '授课教师不合法' })
  instructor?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '课程分类不合法' })
  category?: string;

  @IsOptional()
  @TrimString()
  @IsUUID('all', { message: '课程分类不合法' })
  category_id?: string | null;

  @IsOptional()
  @TrimString()
  @IsIn(COURSE_STATUS, { message: '课程状态不合法' })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '课时数量不合法' })
  @Min(0, { message: '课时数量不合法' })
  lesson_count?: number;
}

export class UpdateCourseDto {
  @IsOptional()
  @TrimString()
  @IsString({ message: '课程名称不能为空' })
  @IsNotEmpty({ message: '课程名称不能为空' })
  name?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '课程描述不合法' })
  description?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '授课教师不合法' })
  instructor?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '课程分类不合法' })
  category?: string;

  @IsOptional()
  @TrimString()
  @IsUUID('all', { message: '课程分类不合法' })
  category_id?: string | null;

  @IsOptional()
  @TrimString()
  @IsIn(COURSE_STATUS, { message: '课程状态不合法' })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '课时数量不合法' })
  @Min(0, { message: '课时数量不合法' })
  lesson_count?: number;
}
