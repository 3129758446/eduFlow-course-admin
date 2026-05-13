import {
  BarChartOutlined,
  BookOutlined,
  FileTextOutlined,
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
];

export function getFirstAccessibleRoute(permissions: readonly string[] = []) {
  return navItems.find((item) => permissions.includes(item.permission))?.path;
}
