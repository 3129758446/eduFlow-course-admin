// 文件作用：系统管理模块请求 DTO，约束账号、角色和权限配置入参。
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OptionalPermissionListDto, RequiredPermissionListDto } from '../../common/dto/permission-list.dto';
import { TrimString } from '../../common/dto/string-transform';

export class UpdateUserRoleDto {
  @TrimString()
  @IsString({ message: '角色不能为空' })
  @IsNotEmpty({ message: '角色不能为空' })
  role!: string;
}

export class CreateUserDto {
  @TrimString()
  @IsString({ message: '用户名、姓名和角色不能为空' })
  @IsNotEmpty({ message: '用户名、姓名和角色不能为空' })
  username!: string;

  @TrimString()
  @IsString({ message: '用户名、姓名和角色不能为空' })
  @IsNotEmpty({ message: '用户名、姓名和角色不能为空' })
  name!: string;

  @TrimString()
  @IsString({ message: '用户名、姓名和角色不能为空' })
  @IsNotEmpty({ message: '用户名、姓名和角色不能为空' })
  role!: string;
}

export class CreateRoleDto extends OptionalPermissionListDto {
  @TrimString()
  @IsString({ message: '角色名称不能为空' })
  @IsNotEmpty({ message: '角色名称不能为空' })
  name!: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '角色描述不合法' })
  description?: string;
}

export class UpdateRoleInfoDto {
  @IsOptional()
  @TrimString()
  @IsString({ message: '角色名称不能为空' })
  @IsNotEmpty({ message: '角色名称不能为空' })
  name?: string;

  @IsOptional()
  @TrimString()
  @IsString({ message: '角色描述不合法' })
  description?: string;
}

export class UpdateRolePermissionsDto extends RequiredPermissionListDto {}
