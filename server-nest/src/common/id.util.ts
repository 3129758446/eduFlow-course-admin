import { fail } from './api.exception';

// 文件作用：统一解析路由 ID，避免 TypeORM 收到 NaN 后抛出底层数据库错误。
export function parsePositiveIntId(value: string, notFoundMessage: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) fail(404, notFoundMessage);
  return id;
}
