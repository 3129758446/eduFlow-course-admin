// 文件作用：定义业务异常类型，用于携带 HTTP 状态码和旧接口格式的错误响应体。
import { HttpException } from '@nestjs/common';

export class ApiException extends HttpException {
  // 作用：创建带旧接口响应体的 HTTP 异常，保证错误格式始终是 { code, msg, data }。
  constructor(status: number, msg: string) {
    // HttpException 的 response 直接存旧接口格式，异常过滤器可以无损透传给前端。
    super({ code: status, msg, data: null }, status);
  }
}

export function fail(status: number, msg: string): never {
  // 业务代码通过 fail 提前中断，等价于 Koa 中 return fail(ctx, status, msg) 的写法。
  throw new ApiException(status, msg);
}
