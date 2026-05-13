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

  const allowed = code
    ? hasPermission(code)
    : any?.length
      ? hasAnyPermission(any)
      : true;

  return allowed ? children : fallback;
}
