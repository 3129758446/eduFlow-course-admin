/*
模块：侧边栏菜单配置
定位：把菜单路径、图标、文案和所需权限集中配置，AppShell 只负责过滤和渲染
好处：新增受权限控制的页面时，只需要补一条配置和对应路由。
*/
import {
  BarChartOutlined,
  BookOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { PERMISSIONS, type PermissionCode } from "../permissions";
import type { RouteKey } from "./route-meta";

export type NavItem = {
  key: Exclude<RouteKey, "login">;
  path: string;
  icon: ReactNode;
  label: string;
  permission: PermissionCode;
};

export const navItems: NavItem[] = [
  {
    key: "dashboard",
    path: "/dashboard",
    icon: <BarChartOutlined />,
    label: "工作台",
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    key: "courses",
    path: "/courses",
    icon: <BookOutlined />,
    label: "课程管理",
    permission: PERMISSIONS.COURSES_VIEW,
  },
  {
    key: "students",
    path: "/students",
    icon: <TeamOutlined />,
    label: "学生管理",
    permission: PERMISSIONS.STUDENTS_VIEW,
  },
  {
    key: "summary",
    path: "/summary",
    icon: <FileTextOutlined />,
    label: "学习总结",
    permission: PERMISSIONS.SUMMARY_VIEW,
  },
  {
    key: "accounts",
    path: "/accounts",
    icon: <SolutionOutlined />,
    label: "账号管理",
    permission: PERMISSIONS.ACCOUNTS_VIEW,
  },
  {
    key: "roles",
    path: "/roles",
    icon: <SafetyCertificateOutlined />,
    label: "角色权限",
    permission: PERMISSIONS.ROLES_VIEW,
  },
];

export function getFirstAccessibleRoute(permissions: readonly string[] = []) {
  return navItems.find((item) => permissions.includes(item.permission))?.path;
}
