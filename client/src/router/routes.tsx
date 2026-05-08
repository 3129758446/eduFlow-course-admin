import { createBrowserRouter, Navigate } from 'react-router-dom';
import {
  CoursesRouteElement,
  DashboardRouteElement,
  LoginRouteElement,
  ProtectedLayoutElement,
  StudentsRouteElement,
  SummaryRouteElement,
} from './page-elements';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginRouteElement />,
  },
  {
    path: '/',
    element: <ProtectedLayoutElement />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardRouteElement />,
      },
      {
        path: 'courses',
        element: <CoursesRouteElement />,
      },
      {
        path: 'students',
        element: <StudentsRouteElement />,
      },
      {
        path: 'summary',
        element: <SummaryRouteElement />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
