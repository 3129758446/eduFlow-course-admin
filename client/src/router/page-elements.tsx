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
    return <LoadingScreen text="正在校验登录状态..." />;
  }

  if (token && user) {
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
    return <LoadingScreen text="正在校验登录状态..." />;
  }

  if (!(token && user)) {
    return <Navigate to="/login" replace />;
  }

  const route = getRouteKeyFromPathname(location.pathname);

  return (
    <AppShell
      route={route === "login" ? "dashboard" : route}
      user={user}
      error={globalError}
      onNavigate={(next) => {
        setGlobalError("");
        navigate(`/${next}`);
      }}
      onLogout={() => {
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
