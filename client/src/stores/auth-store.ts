/* 
模块：认证状态仓库（Zustand）
定位：集中管理登录态（初始化/登录/退出）与全局错误信息，驱动路由守卫与页面级提示
数据流：localStorage(token) -> axios 拦截器注入 -> /api/auth/me 校验 -> user 写入 store
对外：authLoading, initialized, token, user, globalError, initializeAuth, handleLogin, handleLogout, setGlobalError
用法：
- 在应用启动时由 AppRouterProvider 调用 initializeAuth()，完成冷启动登录态校验
- 登录页调用 handleLogin(username, password) 完成登录并持久化 setAuth(token, user)
- 头部用户菜单调用 handleLogout() 清空 localStorage 并 resetAllStores()，确保页面状态一致
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

let initializePromise: Promise<void> | null = null; // 初始化 Promise，避免并发重复请求

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
    // 冷启动期间可能有多个组件同时触发初始化，这里复用同一个 Promise 防止重复请求 /auth/me。
    if (initializePromise) {
      return initializePromise;
    }

    // 初始化认证状态：初始化时根据是否有 token 决定是否 loading，登录成功后更新 token 和用户信息。
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
        // token 过期或无效时，同时清理持久化登录态和所有业务 store，避免残留旧数据。
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
    // 登录成功后，先持久化，再同步更新内存态，刷新页面后仍可恢复登录状态。
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
    // 退出登录要同时清空 localStorage 和所有页面 store，确保下次进入是干净状态。
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
