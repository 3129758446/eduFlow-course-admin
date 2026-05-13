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
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  }

  return children;
}
