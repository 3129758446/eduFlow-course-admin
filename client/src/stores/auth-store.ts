/* 
模块：认证状态仓库（Zustand）
定位：集中管理登录态（初始化/登录/退出）与全局错误信息，驱动路由守卫与页面级提示
数据流：HttpOnly Refresh Cookie -> /api/auth/refresh -> 内存 Access Token -> axios 注入 -> user 写入 store
对外：authLoading, initialized, token, user, globalError, initializeAuth, handleLogin, handleLogout, setGlobalError
用法：
- 在应用启动时由 AppRouterProvider 调用 initializeAuth()，通过 Cookie 静默恢复登录态
- 登录页调用 handleLogin(username, password) 完成登录并写入内存 Access Token
- 头部用户菜单调用 handleLogout() 撤销服务端会话并重置页面状态
学习要点：
- 使用 initializePromise 避免并发重复初始化请求
- 统一通过 setGlobalError 将错误透传到布局层集中展示
*/
import { create } from "zustand";
import { login, logout, refreshSession } from "../api";
import { clearAuth, setAuth } from "../auth";
import type { User } from "../types";
import {
  hasAnyPermission as checkAnyPermission,
  hasPermission as checkPermission,
  type PermissionCode,
} from "../permissions";
import { resetAllStores } from "./reset-registry";

// 认证状态仓库类型定义
type AuthStore = {
  authLoading: boolean;
  initialized: boolean;
  token: string | null;
  user: User | null;
  globalError: string; // 错误信息，用于页面级提示
  setGlobalError: (value: string) => void;
  hasPermission: (code: PermissionCode) => boolean;
  hasAnyPermission: (codes: PermissionCode[]) => boolean;
  initializeAuth: () => Promise<void>;
  handleLogin: (username: string, password: string) => Promise<void>;
  handleLogout: () => void;
};

// 复用冷启动刷新请求，避免多个组件同时轮换同一个 Refresh Token。
let initializePromise: Promise<void> | null = null;

// 认证状态仓库
// 存储登录态（初始化/登录/退出）与全局错误信息，驱动路由守卫与页面级提示
export const useAuthStore = create<AuthStore>((set, get) => ({
  authLoading: true,
  initialized: false, // 登录成功后初始化完成，不再 loading
  token: null,
  user: null, // 登录成功后更新用户信息
  globalError: "", // 错误信息，用于页面级提示
  setGlobalError: (value) => set({ globalError: value }), // 设置全局错误信息
  hasPermission: (code) => checkPermission(get().user?.permissions, code), // 检查用户是否有指定权限
  hasAnyPermission: (codes) => checkAnyPermission(get().user?.permissions, codes), // 检查用户是否有任意指定权限
  initializeAuth: async () => {
    // 冷启动期间可能有多个组件同时触发初始化，这里复用同一个 Promise 防止重复请求 /auth/refresh。
    if (initializePromise) {
      return initializePromise;
    }

    // 浏览器自动携带 HttpOnly Cookie；成功后将短期 Access Token 和用户信息写入内存状态。
    initializePromise = (async () => {
      set({ authLoading: true });

      try {
        const session = await refreshSession();
        set({
          authLoading: false,
          initialized: true,
          token: session.token,
          user: session.user,
        });
      } catch {
        // 刷新令牌过期、被撤销或被判定重放时，清理内存登录态和业务数据，避免残留旧权限。
        clearAuth();
        resetAllStores();
        set({
          authLoading: false,
          initialized: true,
          token: null,
          user: null,
        });
      } finally {
        initializePromise = null;
      }
    })();

    return initializePromise;
  },
  handleLogin: async (username, password) => {
    const data = await login({ username, password });
    // 登录响应的 Refresh Token 已由 HttpOnly Cookie 接收；这里仅保存短期 Access Token 到内存。
    setAuth(data.token);
    set({
      authLoading: false,
      initialized: true,
      token: data.token,
      user: data.user,
      globalError: "",
    });
  },
  handleLogout: () => {
    void logout().catch(() => undefined);
    // 先请求服务端撤销当前会话，再立即清理本地内存与业务状态；请求失败也不保留本地登录态。
    clearAuth();
    resetAllStores();
    set({
      authLoading: false,
      initialized: true,
      token: null,
      user: null,
      globalError: "",
    });
  },
}));
