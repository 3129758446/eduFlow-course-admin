/* 
模块：路由表
定位：集中声明路由层级、受保护路由与默认跳转
数据流：根路由使用 ProtectedLayoutElement 做登录态校验与布局包裹
用法：createBrowserRouter([...]) 导出给 RouterProvider 使用
*/
import { createBrowserRouter, Navigate } from 'react-router-dom';
import {
  AccountsRouteElement,
  CoursesRouteElement,
  DashboardRouteElement,
  DefaultRouteElement,
  ForbiddenRouteElement,
  LoginRouteElement,
  ProtectedLayoutElement,
  StudentsRouteElement,
  SummaryRouteElement,
} from './page-elements';
import { PERMISSIONS } from '../permissions';
import { RequirePermission } from './RequirePermission';

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
        element: <DefaultRouteElement />,
      },
      {
        path: 'dashboard',
        element: (
          <RequirePermission code={PERMISSIONS.DASHBOARD_VIEW}>
            <DashboardRouteElement />
          </RequirePermission>
        ),
      },
      {
        path: 'courses',
        element: (
          <RequirePermission code={PERMISSIONS.COURSES_VIEW}>
            <CoursesRouteElement />
          </RequirePermission>
        ),
      },
      {
        path: 'students',
        element: (
          <RequirePermission code={PERMISSIONS.STUDENTS_VIEW}>
            <StudentsRouteElement />
          </RequirePermission>
        ),
      },
      {
        path: 'summary',
        element: (
          <RequirePermission code={PERMISSIONS.SUMMARY_VIEW}>
            <SummaryRouteElement />
          </RequirePermission>
        ),
      },
      {
        path: 'accounts',
        element: (
          <RequirePermission code={PERMISSIONS.ACCOUNTS_VIEW}>
            <AccountsRouteElement />
          </RequirePermission>
        ),
      },
      {
        path: '403',
        element: <ForbiddenRouteElement />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
