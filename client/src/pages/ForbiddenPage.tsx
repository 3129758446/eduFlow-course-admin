import { Button, Result } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { getFirstAccessibleRoute } from "../router/nav-config";
import { useAuthStore } from "../stores/auth-store";

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  teacher: "教师",
  student: "学生",
};

export function ForbiddenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? [];
  const firstRoute = getFirstAccessibleRoute(permissions) ?? "/login";
  const requiredPermission =
    typeof location.state?.requiredPermission === "string"
      ? location.state.requiredPermission
      : "";

  return (
    <Result
      status="403"
      title="403"
      subTitle={
        <span>
          当前角色：{ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? "未知角色"}
          {requiredPermission ? `，缺少权限：${requiredPermission}` : ""}
        </span>
      }
      extra={
        <Button type="primary" onClick={() => navigate(firstRoute, { replace: true })}>
          返回可访问页面
        </Button>
      }
    />
  );
}
