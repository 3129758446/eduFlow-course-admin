import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";
import { getFirstAccessibleRoute } from "../router/nav-config";
import { useAuthStore } from "../stores/auth-store";

export function ForbiddenPage() {
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const firstRoute = getFirstAccessibleRoute(permissions) ?? "/login";

  return (
    <Result
      status="403"
      title="403"
      subTitle="当前账号没有访问该页面的权限"
      extra={
        <Button type="primary" onClick={() => navigate(firstRoute, { replace: true })}>
          返回可访问页面
        </Button>
      }
    />
  );
}
