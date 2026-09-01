// 文件作用：提供 DTO 字符串 trim 转换器，避免空格字符串绕过非空校验。
import { Transform } from 'class-transformer';

export function TrimString() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}
