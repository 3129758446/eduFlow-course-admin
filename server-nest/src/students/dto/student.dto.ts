// 文件作用：学员模块请求 DTO，约束列表查询、学号校验、新增和编辑入参。
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TrimString } from '../../common/dto/string-transform';

const STUDENT_STATUS = ['active', 'inactive'] as const;

export class StudentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @TrimString()
  @IsString({ message: '关键词不合法' })
  keyword?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '班级不合法' })
  className?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '班级不合法' })
  class_name?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '课程 ID 不合法' })
  courseId?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '课程 ID 不合法' })
  course_id?: string;

  @IsOptional()
  @TrimString()
  @IsIn(STUDENT_STATUS, { message: '学生状态不合法' })
  status?: string;
}

export class CheckStudentNoQueryDto {
  @TrimString()
  @IsString({ message: '学号不能为空' })
  @IsNotEmpty({ message: '学号不能为空' })
  student_no!: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '排除 ID 不合法' })
  excludeId?: string;
}

export class CreateStudentDto {
  @TrimString()
  @IsString({ message: '学生姓名和学号不能为空' })
  @IsNotEmpty({ message: '学生姓名和学号不能为空' })
  name!: string;

  @TrimString()
  @IsString({ message: '学生姓名和学号不能为空' })
  @IsNotEmpty({ message: '学生姓名和学号不能为空' })
  @Matches(/^\d{8}$/, { message: '学号格式应为 8 位数字' })
  student_no!: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '班级不合法' })
  class_name?: string;

  @TrimString()
  @IsString({ message: '手机号格式不正确' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @TrimString()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsOptional()
  @TrimString()
  @IsIn(STUDENT_STATUS, { message: '学生状态不合法' })
  status?: string;

  @IsArray({ message: 'course_ids 必须是数字数组' })
  @ArrayMinSize(1, { message: '请至少选择一门课程' })
  // 作用：兼容前端可能传入的数字字符串数组，最终交给 Service 去重和校验课程是否存在。
  @Type(() => Number)
  @IsInt({ each: true, message: 'course_ids 必须是数字数组' })
  @Min(1, { each: true, message: 'course_ids 必须是数字数组' })
  course_ids!: number[];
}

export class UpdateStudentDto {
  @IsOptional()
  @TrimString()
  @IsString({ message: '学生姓名和学号不能为空' })
  @IsNotEmpty({ message: '学生姓名和学号不能为空' })
  name?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '学生姓名和学号不能为空' })
  @IsNotEmpty({ message: '学生姓名和学号不能为空' })
  @Matches(/^\d{8}$/, { message: '学号格式应为 8 位数字' })
  student_no?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '班级不合法' })
  class_name?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '手机号格式不正确' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @TrimString()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @IsOptional()
  @TrimString()
  @IsIn(STUDENT_STATUS, { message: '学生状态不合法' })
  status?: string;

  @IsOptional()
  @IsArray({ message: 'course_ids 必须是数字数组' })
  @ArrayMinSize(1, { message: '请至少选择一门课程' })
  // 作用：编辑时仅在传入 course_ids 时校验，未传则由 Service 沿用数据库原值。
  @Type(() => Number)
  @IsInt({ each: true, message: 'course_ids 必须是数字数组' })
  @Min(1, { each: true, message: 'course_ids 必须是数字数组' })
  course_ids?: number[];
}
