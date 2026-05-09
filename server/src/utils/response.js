/* 
模块：响应工具
定位：统一成功/失败响应体结构，前端可据此在拦截器中集中处理
*/
export function success(ctx, data = null, msg = 'success') {
  ctx.body = { code: 0, msg, data };
}

export function fail(ctx, status, msg) {
  ctx.status = status;
  ctx.body = { code: status, msg, data: null };
}
