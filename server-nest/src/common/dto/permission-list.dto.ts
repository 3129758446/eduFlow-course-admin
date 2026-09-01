// 文件作用：复用权限码数组校验，确保角色权限配置只接收字符串数组。
import { IsArray, IsOptional, IsString } from 'class-validator';

export class OptionalPermissionListDto {
  @IsOptional()
  @IsArray({ message: 'permissions 必须是数组' })
  @IsString({ each: true, message: 'permissions 必须是字符串数组' })
  permissions?: string[];
}

export class RequiredPermissionListDto {
  @IsArray({ message: 'permissions 必须是数组' })
  @IsString({ each: true, message: 'permissions 必须是字符串数组' })
  permissions!: string[];
}
