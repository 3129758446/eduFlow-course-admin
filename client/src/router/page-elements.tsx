/* 
模块：路由渲染元素
定位：将路由守卫、导航、全局错误提示与页面组件装配起来
数据流：useRouterAuth() 从 auth store 取鉴权与错误；AppShell 统一展示和导航
用法：LoginRouteElement/ProtectedLayoutElement 作为 routes.tsx 的 element
学习要点：受保护路由用 Navigate 重定向未登录用户；退出后清空并跳转登录
*/
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LoadingScreen } from "../components/feedback";
import { AppShell } from "../layouts/AppShell";
import { useRouterAuth } from "./use-router-auth";
import { getRouteKeyFromPathname } from "./route-meta";
import { getFirstAccessibleRoute } from "./nav-config";

// 懒加载页面组件
const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const CoursesPage = lazy(() =>
  import("../pages/CoursesPage").then((module) => ({ default: module.CoursesPage })),
);
const StudentsPage = lazy(() =>
  import("../pages/StudentsPage").then((module) => ({ default: module.StudentsPage })),
);
const SummaryPage = lazy(() =>
  import("../pages/SummaryPage").then((module) => ({ default: module.SummaryPage })),
);
const AccountsPage = lazy(() =>
  import("../pages/AccountsPage").then((module) => ({ default: module.AccountsPage })),
);
const ForbiddenPage = lazy(() =>
  import("../pages/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage })),
);

function renderLazyPage(children: ReactNode) {
  // 页面组件按路由拆包加载，fallback 复用现有全屏 loading，避免出现空白跳转。
  return <Suspense fallback={<LoadingScreen text="正在加载页面..." />}>{children}</Suspense>;
}

export function LoginRouteElement() {
  const { authLoading, token, user, globalError, setGlobalError, handleLogin } =
    useRouterAuth();

  if (authLoading) {
    // 应用启动时先等登录态校验结束，避免“明明已登录却先看到登录页”的闪烁。
    return <LoadingScreen text="正在校验登录状态..." />;
  }

  if (token && user) {
    // 已登录用户访问 /login 时直接送回第一个有权限的页面，避免重复登录。
    return (
      <Navigate
        to={getFirstAccessibleRoute(user.permissions) ?? "/403"}
        replace
      />
    );
  }

  // 未登录用户访问 /login 时展示登录页。
  return renderLazyPage(
    <LoginPage
      onLogin={handleLogin}
      error={globalError} 
      setError={setGlobalError}
    />,
  );
}

// 登录态校验成功后，将所有受保护路由的 element 包一层 AppShell。
export function ProtectedLayoutElement() {
  const {
    authLoading,
    token,
    user,
    globalError,
    setGlobalError,
    handleLogout,
  } = useRouterAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (authLoading) {
    // 受保护路由与登录页保持一致：初始化期间只展示统一 loading 态。
    return <LoadingScreen text="正在校验登录状态..." />;
  }

  if (!(token && user)) {
    // 没有合法登录态时，任何受保护页面都强制回到登录页。
    return <Navigate to="/login" replace />;
  }

  // 根据 pathname 推导当前菜单高亮项，让布局层不必感知具体页面组件。
  const route = getRouteKeyFromPathname(location.pathname);

  return (
    <AppShell
      route={route === "login" ? "dashboard" : route}
      user={user}
      error={globalError}
      onNavigate={(next) => {
        // 切换页面前顺手清掉旧错误，避免上一页报错残留到下一页。
        setGlobalError("");
        navigate(`/${next}`);
      }}
      onLogout={() => {
        // 先清空登录态与 store，再 replace 到登录页，避免回退返回受保护页面。
        handleLogout();
        navigate("/login", { replace: true });
      }}
    >
      <Outlet />
    </AppShell>
  );
}

export function DashboardRouteElement() {
  return renderLazyPage(<DashboardPage />);
}

export function DefaultRouteElement() {
  const { user } = useRouterAuth();
  return (
    <Navigate
      to={getFirstAccessibleRoute(user?.permissions) ?? "/403"}
      replace
    />
  );
}

export function CoursesRouteElement() {
  return renderLazyPage(<CoursesPage />);
}

export function StudentsRouteElement() {
  return renderLazyPage(<StudentsPage />);
}

export function SummaryRouteElement() {
  return renderLazyPage(<SummaryPage />);
}

export function ForbiddenRouteElement() {
  return renderLazyPage(<ForbiddenPage />);
}

export function AccountsRouteElement() {
  return renderLazyPage(<AccountsPage />);
}
