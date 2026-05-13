/*
模块：角色权限页
定位：admin 用于查看角色，并为 teacher/student 勾选权限；admin 永远固定为全部权限
数据流：fetchRolePermissions -> 按模块分组权限 -> draftPermissions 临时勾选 -> 保存 updateRolePermissions
学习要点：角色权限保存到数据库后，登录和接口鉴权都会读取最新权限。
*/
import { ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchRolePermissions,
  updateRolePermissions,
} from "../api";
import {
  RolePermissionCard,
  type PermissionGroup,
} from "../components/RolePermissionCard";
import { Card } from "../components/ui";
import { useAuthStore } from "../stores/auth-store";
import type { Role, SystemPermission } from "../types";
import { appErrorMessage } from "../utils/text";

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const currentRole = useAuthStore((state) => state.user?.role);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  // 后端返回的是扁平权限列表，页面按 module_name 分组，减少勾选时的认知成本。
  const permissionGroups = useMemo(() => {
    const groups = new Map<string, SystemPermission[]>();
    for (const permission of permissions) {
      const groupName = permission.module_name || permission.module || "其他";
      groups.set(groupName, [...(groups.get(groupName) ?? []), permission]);
    }
    return Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items,
    })) satisfies PermissionGroup[];
  }, [permissions]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRolePermissions();
      setRoles(data.roles);
      setPermissions(data.permissions);
      setDraftPermissions(
        Object.fromEntries(
          data.roles.map((role) => [role.code, role.permissions]),
        ),
      );
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const handleSave = useCallback(async (role: Role) => {
    if (role.code === "admin") {
      message.warning("管理员固定拥有全部权限，不支持修改");
      return;
    }

    const nextPermissions = draftPermissions[role.code] ?? [];
    setSavingRole(role.code);
    try {
      await updateRolePermissions(role.code, nextPermissions);
      setRoles((prev) =>
        prev.map((item) =>
          item.code === role.code
            ? { ...item, permissions: nextPermissions }
            : item,
        ),
      );
      if (currentRole === role.code) {
        // 如果 admin 正在修改自己的角色权限，保存后立刻刷新当前登录态，菜单和按钮才会同步变化。
        await initializeAuth();
      }
      message.success("角色权限已保存");
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setSavingRole(null);
    }
  }, [currentRole, draftPermissions, initializeAuth]);

  const hasChanges = useCallback((role: Role) => {
    if (role.code === "admin") {
      return false;
    }

    const source = [...role.permissions].sort().join(",");
    const draft = [...(draftPermissions[role.code] ?? [])].sort().join(",");
    return source !== draft;
  }, [draftPermissions]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">角色权限</h2>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            void loadData();
          }}
          className="manage-action-button bg-white text-lg font-bold text-slate-900"
        >
          刷新
        </Button>
      </div>

      {loading ? (
        <Card title="" className="manage-card">
          <div className="py-12 text-center text-slate-400">正在加载角色权限...</div>
        </Card>
      ) : roles.length === 0 ? (
        <Card title="" className="manage-card">
          <Empty description="暂无角色数据" />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {roles.map((role) => (
            <RolePermissionCard
              key={role.code}
              role={role}
              permissionGroups={permissionGroups}
              selectedPermissions={
                role.code === "admin"
                  ? permissions.map((permission) => permission.code)
                  : draftPermissions[role.code] ?? []
              }
              readonly={role.code === "admin"}
              changed={hasChanges(role)}
              saving={savingRole === role.code}
              onSave={() => {
                void handleSave(role);
              }}
              onChange={(nextPermissions) =>
                setDraftPermissions((prev) => ({
                  ...prev,
                  [role.code]: nextPermissions,
                }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
