/* 
模块：路由渲染元素
定位：将路由守卫、导航、全局错误提示与页面组件装配起来
数据流：useRouterAuth() 从 auth store 取鉴权与错误；AppShell 统一展示和导航
用法：LoginRouteElement/ProtectedLayoutElement 作为 routes.tsx 的 element
学习要点：受保护路由用 Navigate 重定向未登录用户；退出后清空并跳转登录
*/
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LoadingScreen } from "../components/feedback";
import { AppShell } from "../layouts/AppShell";
import { LoginPage } from "../pages/LoginPage";
import { CoursesPage } from "../pages/CoursesPage";
import { DashboardPage } from "../pages/DashboardPage";
import { StudentsPage } from "../pages/StudentsPage";
import { SummaryPage } from "../pages/SummaryPage";
import { useRouterAuth } from "./use-router-auth";
import { getRouteKeyFromPathname } from "./route-meta";

export function LoginRouteElement() {
  const { authLoading, token, user, globalError, setGlobalError, handleLogin } =
    useRouterAuth();

  if (authLoading) {
    // 应用启动时先等登录态校验结束，避免“明明已登录却先看到登录页”的闪烁。
    return <LoadingScreen text="正在校验登录状态..." />;
  }

  if (token && user) {
    // 已登录用户访问 /login 时直接送回工作台，避免重复登录。
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      error={globalError}
      setError={setGlobalError}
    />
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
  return <DashboardPage />;
}

export function CoursesRouteElement() {
  return <CoursesPage />;
}

export function StudentsRouteElement() {
  return <StudentsPage />;
}

export function SummaryRouteElement() {
  return <SummaryPage />;
}
