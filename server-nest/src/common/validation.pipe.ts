// 文件作用：集中创建全局 ValidationPipe，把 DTO 校验错误转换成旧接口兼容的 { code, msg, data } 格式。
import { ValidationPipe, ValidationError } from '@nestjs/common';
import { ApiException } from './api.exception';

export function createValidationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
    // 作用：让 class-validator 的错误继续走项目统一异常格式，避免前端收到 Nest 默认错误结构。
    exceptionFactory: (errors: ValidationError[]) => new ApiException(400, getFirstValidationMessage(errors)),
  });
}

// 作用：从嵌套 DTO 校验错误中提取第一条中文提示，保持旧接口只返回单条 msg 的约定。
function getFirstValidationMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    const message = firstConstraintMessage(error);
    if (message) return message;
  }
  return '请求参数不合法';
}

// 作用：优先读当前字段错误；如果是嵌套对象或数组，再递归读取子字段错误。
function firstConstraintMessage(error: ValidationError): string | undefined {
  if (error.constraints) {
    const [message] = Object.values(error.constraints);
    if (message) return message;
  }
  for (const child of error.children ?? []) {
    const message = firstConstraintMessage(child);
    if (message) return message;
  }
  return undefined;
}
