import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/dto/string-transform';

// 文件作用：课程分类新增/编辑请求 DTO。
export class SaveCourseCategoryDto {
  @TrimString()
  @IsString({ message: '课程分类名称不能为空' })
  @IsNotEmpty({ message: '课程分类名称不能为空' })
  @MaxLength(100, { message: '课程分类名称不能超过 100 个字符' })
  name!: string;
}
