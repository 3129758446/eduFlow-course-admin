/* 
模块：路由鉴权 Hook
定位：以浅比较组合 auth store 字段，避免路由层重复渲染
对外：authLoading/initialized/token/user/globalError 及控制函数
用法：路由元素中调用 useRouterAuth() 简化取值
*/
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/auth-store';

export function useRouterAuth() {
  return useAuthStore(
    // 仅浅比较 auth store 字段，避免路由层重复渲染。
    useShallow((state) => ({
      authLoading: state.authLoading,
      initialized: state.initialized,
      token: state.token,
      user: state.user,
      globalError: state.globalError,
      setGlobalError: state.setGlobalError,
      handleLogin: state.handleLogin,
      handleLogout: state.handleLogout,
    }))
  );
}
