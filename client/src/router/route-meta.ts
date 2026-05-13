/* 
模块：路由元信息
定位：从 pathname 推导侧边栏高亮 key
*/
export type RouteKey =
  | 'login'
  | 'dashboard'
  | 'courses'
  | 'students'
  | 'summary'
  | 'accounts';

// 从 pathname 推导侧边栏高亮 key
// pathname.startsWith 方法判断 pathname 是否以指定的前缀开头
export function getRouteKeyFromPathname(pathname: string): RouteKey {
  if (pathname.startsWith('/dashboard')) return 'dashboard';  
  if (pathname.startsWith('/courses')) return 'courses';
  if (pathname.startsWith('/students')) return 'students';
  if (pathname.startsWith('/summary')) return 'summary';
  if (pathname.startsWith('/accounts')) return 'accounts';
  return 'login';
}
