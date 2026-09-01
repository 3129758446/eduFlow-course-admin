// 文件作用：认证模块请求 DTO，约束登录和修改密码的基础字段。
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { TrimString } from '../../common/dto/string-transform';

export class LoginDto {
  @TrimString()
  @IsString({ message: '请输入用户名和密码' })
  @IsNotEmpty({ message: '请输入用户名和密码' })
  username!: string;

  @IsString({ message: '请输入用户名和密码' })
  @IsNotEmpty({ message: '请输入用户名和密码' })
  password!: string;
}

export class ChangePasswordDto {
  @IsString({ message: '原密码和新密码不能为空' })
  @IsNotEmpty({ message: '原密码和新密码不能为空' })
  oldPassword!: string;

  @IsString({ message: '原密码和新密码不能为空' })
  @IsNotEmpty({ message: '原密码和新密码不能为空' })
  @MinLength(6, { message: '新密码至少需要 6 位' })
  newPassword!: string;
}
