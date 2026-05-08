import { Navigate, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { LoadingScreen } from '../components/feedback';
import { AppShell } from '../layouts/AppShell';
import { LoginPage } from '../pages/LoginPage';
import { CoursesPage } from '../pages/CoursesPage';
import { DashboardPage } from '../pages/DashboardPage';
import { StudentsPage } from '../pages/StudentsPage';
import { SummaryPage } from '../pages/SummaryPage';
import { useRouterAuth } from './use-router-auth';
import { getRouteKeyFromPathname } from './route-meta';

type ShellOutletContext = {
  setGlobalError: (value: string) => void;
};

export function LoginRouteElement() {
  const { authLoading, token, user, globalError, setGlobalError, handleLogin } = useRouterAuth();

  if (authLoading) {
    return <LoadingScreen text="正在校验登录状态..." />;
  }

  if (token && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginPage onLogin={handleLogin} error={globalError} setError={setGlobalError} />;
}

export function ProtectedLayoutElement() {
  const { authLoading, token, user, globalError, setGlobalError, handleLogout } = useRouterAuth();
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
      route={route === 'login' ? 'dashboard' : route}
      user={user}
      error={globalError}
      onNavigate={(next) => {
        setGlobalError('');
        navigate(`/${next}`);
      }}
      onLogout={() => {
        handleLogout();
        navigate('/login', { replace: true });
      }}
    >
      <Outlet context={{ setGlobalError }} />
    </AppShell>
  );
}

function useShellOutletHelpers() {
  return useOutletContext<ShellOutletContext>();
}

export function DashboardRouteElement() {
  const { setGlobalError } = useShellOutletHelpers();
  return <DashboardPage setGlobalError={setGlobalError} />;
}

export function CoursesRouteElement() {
  const { setGlobalError } = useShellOutletHelpers();
  return <CoursesPage setGlobalError={setGlobalError} />;
}

export function StudentsRouteElement() {
  const { setGlobalError } = useShellOutletHelpers();
  return <StudentsPage setGlobalError={setGlobalError} />;
}

export function SummaryRouteElement() {
  const { setGlobalError } = useShellOutletHelpers();
  return <SummaryPage setGlobalError={setGlobalError} />;
}
