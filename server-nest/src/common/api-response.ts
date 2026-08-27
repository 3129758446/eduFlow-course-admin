// 文件作用：封装统一成功响应和业务失败抛错方法，保持前端依赖的 code/msg/data 格式不变。
export interface ApiEnvelope<T = unknown> {
  code: number;
  msg: string;
  data: T | null;
}

export function ok<T = unknown>(data: T | null = null, msg = 'success'): ApiEnvelope<T> {
  // 前端 request<T>() 只解包 data，因此所有成功响应都必须保留旧 Koa 的 envelope 结构。
  return { code: 0, msg, data };
}
