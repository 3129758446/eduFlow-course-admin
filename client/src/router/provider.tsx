/* 
模块：路由提供器
定位：应用入口挂载 RouterProvider，并在首次挂载执行登录态初始化
数据流：useAuthStore.initializeAuth() -> 校验 token -> 初始化完成后正常渲染路由
用法：在 App.tsx 中直接渲染 <AppRouterProvider />
*/
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { useAuthStore } from '../stores/auth-store';

export function AppRouterProvider() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return <RouterProvider router={router} />;
}
