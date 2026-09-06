/* 
模块：Access Token 内存状态
定位：封装 Access Token 的内存读写，供请求拦截器使用
对外：getAuthToken(), setAuth(token, user), clearAuth()
用法：
- 登录或刷新成功后 setAuth 写入；退出或刷新失败时 clearAuth 清理
学习要点：Refresh Token 由浏览器以 HttpOnly Cookie 保存，JavaScript 无法读取
*/
const TOKEN_KEY = 'course_admin_token';
const USER_KEY = 'course_admin_user';
let accessToken: string | null = null;

// Access Token 只在当前页面内存中保存，页面刷新后由 Refresh Token 换取新令牌。
export function getAuthToken() {
  return accessToken;
}

// 登录或静默刷新成功后更新内存中的 Access Token。
export function setAuth(token: string) {
  accessToken = token;
}

// 清除内存令牌；同时移除旧版本可能遗留的 localStorage 数据，避免误恢复登录态。
export function clearAuth() {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
