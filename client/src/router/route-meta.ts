/* 
模块：路由元信息
定位：从 pathname 推导侧边栏高亮 key
*/
export type RouteKey = 'login' | 'dashboard' | 'courses' | 'students' | 'summary';

export function getRouteKeyFromPathname(pathname: string): RouteKey {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/courses')) return 'courses';
  if (pathname.startsWith('/students')) return 'students';
  if (pathname.startsWith('/summary')) return 'summary';
  return 'login';
}
