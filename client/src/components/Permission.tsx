/*
模块：权限展示组件
定位：用声明式方式控制按钮、表格操作等局部 UI 是否渲染
用法：
  <Permission code={PERMISSIONS.COURSES_CREATE}>...</Permission>
  <Permission any={[PERMISSIONS.COURSES_UPDATE, PERMISSIONS.COURSES_DELETE]}>...</Permission>
说明：它只负责前端展示控制，真正的安全边界仍然在后端 requirePermission 中间件。
*/
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/auth-store";
import type { PermissionCode } from "../permissions";

type PermissionProps = {
  code?: PermissionCode;
  any?: PermissionCode[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function Permission({
  code,
  any,
  fallback = null,
  children,
}: PermissionProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasAnyPermission = useAuthStore((state) => state.hasAnyPermission);

  // code 与 any 二选一：code 适合单权限按钮，any 适合“有任意操作权限就显示”的区域。
  const allowed = code
    ? hasPermission(code)
    : any?.length
      ? hasAnyPermission(any)
      : true;

  return allowed ? children : fallback;
}
