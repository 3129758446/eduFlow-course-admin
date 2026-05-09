/* 
模块：登录态持久化
定位：封装 token 与 user 的 localStorage 读写，供请求拦截与路由守卫使用
对外：getAuthToken(), setAuth(token, user), clearAuth()
用法：
- 登录成功后 setAuth 写入；退出或 401 时 clearAuth 清理
学习要点：持久化只做存取，不做业务判断，业务逻辑放在 store
*/
import type { User } from './types';

const TOKEN_KEY = 'course_admin_token';
const USER_KEY = 'course_admin_user';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
