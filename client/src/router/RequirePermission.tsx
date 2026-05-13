/*
模块：路由权限守卫
定位：保护受权限控制的页面，避免用户手动输入 URL 绕过侧边栏菜单过滤
数据流：路由配置传入所需权限 -> auth-store 判断 -> 无权限跳转 403 并携带缺失权限码
*/
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { PermissionCode } from "../permissions";
import { useAuthStore } from "../stores/auth-store";

export function RequirePermission({
  code,
  children,
}: {
  code: PermissionCode;
  children: ReactNode;
}) {
  const location = useLocation();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  if (!hasPermission(code)) {
    // 把缺失权限带到 403 页面，方便用户演示和开发调试时定位原因。
    return (
      <Navigate
        to="/403"
        replace
        state={{ from: location.pathname, requiredPermission: code }}
      />
    );
  }

  return children;
}
