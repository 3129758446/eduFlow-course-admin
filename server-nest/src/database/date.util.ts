// 文件作用：提供数据库日期字符串格式化工具，统一近 7 天统计和日期时间返回口径。
export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 作用：按 Node 运行时本地时区格式化 DATETIME，避免固定加 8 小时导致时区重复偏移。
export function formatLocalDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${formatLocalDate(date)} ${hours}:${minutes}:${seconds}`;
}
