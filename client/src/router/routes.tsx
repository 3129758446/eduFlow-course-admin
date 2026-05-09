/* 
模块：路由表
定位：集中声明路由层级、受保护路由与默认跳转
数据流：根路由使用 ProtectedLayoutElement 做登录态校验与布局包裹
用法：createBrowserRouter([...]) 导出给 RouterProvider 使用
*/
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
