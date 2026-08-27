// 文件作用：统一处理业务异常和运行时异常，保证响应结构与旧 Koa 服务保持一致。
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

  @Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  // 作用：兜底处理所有异常，把 Nest 默认错误和业务错误统一成前端可识别的旧接口格式。
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      // 如果业务主动抛出 ApiException，响应体已经是 { code, msg, data }，这里直接透传。
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (body && typeof body === 'object' && 'code' in body) {
        response.status(status).json(body);
        return;
      }
      response.status(status).json({
        code: status,
        msg: exception.message || '请求失败',
        data: null,
      });
      return;
    }

    // 未捕获异常也要落到统一响应结构，避免前端拦截器拿不到 msg/data。
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      msg: exception instanceof Error ? exception.message : '服务器内部错误',
      data: null,
    });
  }
}
