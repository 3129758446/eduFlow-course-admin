/* 
模块：应用布局壳
定位：提供侧边导航/顶部用户菜单/错误提醒容器，插槽渲染页面内容
数据流：父级通过 props 传入当前路由 key、用户信息与错误消息及导航/退出回调
用法：受保护路由包裹 Outlet，集中管理导航与退出确认
学习要点：导航前清空全局错误；退出时弹出二次确认 Popconfirm
*/
import {
  BarChartOutlined,
  BookOutlined,
  DownOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Dropdown, Layout, Menu, Popconfirm } from "antd";
import type { MenuProps } from "antd";
import { useState, type ReactNode } from "react";
import type { RouteKey } from "../router";
import type { User } from "../types";
import { parseMaybeChinese } from "../utils/text";

const { Header, Sider, Content } = Layout;

export function AppShell({
  route,
  user,
  error,
  onNavigate,
  onLogout,
  children,
}: {
  route: RouteKey;
  user: User;
  error: string;
  onNavigate: (route: RouteKey) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  const navItems: Array<{
    key: Exclude<RouteKey, "login">;
    icon: ReactNode;
    label: string;
  }> = [
    { key: "dashboard", icon: <BarChartOutlined />, label: "工作台" },
    { key: "courses", icon: <BookOutlined />, label: "课程管理" },
    { key: "students", icon: <TeamOutlined />, label: "学生管理" },
    { key: "summary", icon: <FileTextOutlined />, label: "学习总结" },
  ];

  const userMenuItems: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      danger: true,
      onClick: () => setLogoutConfirmOpen(true),
    },
  ];

  return (
    <Layout className="min-h-screen bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_34px,#f6f3ee_34px,#f6f3ee_36px)]">
      <Sider
        width="clamp(260px, 22vw, 360px)"
        breakpoint="lg"
        collapsible
        collapsed={siderCollapsed}
        collapsedWidth={0}
        trigger={null}
        onCollapse={setSiderCollapsed}
        theme="light"
        style={{
          background: "rgba(255,255,255,0.96)",
          borderRight: "4px solid #222",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div className="flex h-full flex-col px-3 py-5">
          {/* 左侧区域分成品牌头部与导航菜单两部分，结构和后台系统习惯一致。 */}
          <div className="border-b-4 border-[#222] px-3 pb-4">
            <div className="flex items-center gap-3 text-slate-900">
              <span className="text-4xl">🎓</span>
              <span className="m-0 text-3xl font-extrabold tracking-tight">
                学习管理平台
              </span>
            </div>
          </div>

          <Menu
            // 菜单项来源于 navItems 配置，后续新增页面时只需要补配置即可。
            mode="inline"
            selectedKeys={[route === "login" ? "dashboard" : route]}
            items={navItems.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
              onClick: () => onNavigate(item.key),
            }))}
            className="app-nav-menu mt-6 border-0 bg-transparent text-lg [&_.ant-menu-item]:mb-4 [&_.ant-menu-item]:h-26 [&_.ant-menu-item]:rounded-5 [&_.ant-menu-item]:px-9 [&_.ant-menu-item]:leading-26 [&_.ant-menu-item-selected]:border-4 [&_.ant-menu-item-selected]:border-sky-500 [&_.ant-menu-item-selected]:bg-[#d9e9ff] [&_.ant-menu-item-icon]:mr-4 [&_.ant-menu-item-icon]:text-4xl [&_.ant-menu-title-content]:text-3xl [&_.ant-menu-title-content]:font-extrabold"
          />
        </div>
      </Sider>

      <Layout style={{ background: "transparent" }}>
        <Header
          className="px-8 pt-5"
          style={{
            background: "transparent",
            height: "auto",
            lineHeight: "normal",
            paddingBottom: 0,
          }}
        >
          <div className="flex items-center justify-between">
            <Button
              type="text"
              icon={<MenuOutlined />}
              aria-label={siderCollapsed ? "展开侧边栏" : "收起侧边栏"}
              onClick={() => setSiderCollapsed((collapsed) => !collapsed)}
              className="h-auto border-0 p-0 text-3xl text-slate-700 shadow-none hover:bg-transparent! hover:text-slate-900!"
            />

            <Popconfirm
              // 退出登录既出现在下拉菜单中，又由 Popconfirm 包裹，避免误触直接退出。
              title="确认退出登录吗？"
              description="退出后需要重新登录才能继续操作。"
              icon={<QuestionCircleOutlined className="text-amber-500" />}
              open={logoutConfirmOpen}
              onConfirm={() => {
                setLogoutConfirmOpen(false);
                onLogout();
              }}
              onCancel={() => setLogoutConfirmOpen(false)}
              okText="确认"
              cancelText="取消"
              placement="bottomRight"
            >
              <Dropdown
                menu={{ items: userMenuItems }}
                trigger={["click"]}
                placement="bottomRight"
                overlayClassName="user-dropdown-overlay"
                onOpenChange={(open) => {
                  if (open) {
                    setLogoutConfirmOpen(false);
                  }
                }}
              >
                <Button
                  type="text"
                  className="h-auto border-0 px-0 text-lg font-medium text-slate-800 shadow-none hover:bg-transparent! hover:text-slate-900!"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <UserOutlined className="text-2xl text-violet-800" />
                    <span className="text-xl font-bold">
                      {parseMaybeChinese(
                        user.name || user.username || "管理员",
                      )}
                    </span>
                    <DownOutlined className="text-xs" />
                  </span>
                </Button>
              </Dropdown>
            </Popconfirm>
          </div>

          <div className="mt-4 border-b-4 border-dashed border-slate-300" />
        </Header>

        <Content
          className="px-6 pb-8 pt-6 xl:px-8"
          style={{ background: "transparent" }}
        >
          {/* 错误提示固定放在内容区顶部，让各业务页不用重复写 Alert。 */}
          {error ? (
            <Alert
              message={error}
              type="error"
              showIcon
              className="mb-5 rounded-2xl border-3 border-rose-300"
            />
          ) : null}
          <div className="w-full min-w-0">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
