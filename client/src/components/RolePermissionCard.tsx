/*
模块：角色权限卡片
定位：封装角色权限页中每个角色的展示、权限勾选和保存按钮
说明：admin 会以 readonly 模式展示全部权限；teacher/student 可编辑并通过二次确认保存。
*/
import { SaveOutlined } from "@ant-design/icons";
import { Button, Checkbox, Popconfirm, Tag } from "antd";
import type { Role, SystemPermission } from "../types";
import { Permission } from "./Permission";
import { PERMISSIONS } from "../permissions";
import { Card } from "./ui";

export type PermissionGroup = {
  name: string;
  items: SystemPermission[];
};

export function RolePermissionCard({
  role,
  permissionGroups,
  selectedPermissions,
  readonly = false,
  changed = false,
  saving = false,
  onChange,
  onSave,
}: {
  role: Role;
  permissionGroups: PermissionGroup[];
  selectedPermissions: string[];
  readonly?: boolean;
  changed?: boolean;
  saving?: boolean;
  onChange?: (permissions: string[]) => void;
  onSave?: () => void;
}) {
  return (
    <Card
      title={role.name}
      actions={
        readonly ? (
          <Tag className="list-chip list-chip--blue">固定全权限</Tag>
        ) : (
          <Permission code={PERMISSIONS.ROLES_UPDATE_PERMISSIONS}>
            <Popconfirm
              title={`确认保存“${role.name}”的权限配置吗？`}
              description="保存后会立即影响该角色账号可访问的菜单、按钮和接口。"
              onConfirm={onSave}
              okText="确认"
              cancelText="取消"
              disabled={!changed}
            >
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!changed}
                loading={saving}
              >
                保存
              </Button>
            </Popconfirm>
          </Permission>
        )
      }
      className="manage-card"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <Tag className="list-chip list-chip--violet">{role.code}</Tag>
        <span className="text-sm text-slate-400">
          已选 {selectedPermissions.length} 项
        </span>
      </div>
      <p className="mt-0 text-base leading-7 text-slate-500">
        {readonly
          ? "管理员是系统最高权限角色，固定拥有全部权限，不允许在页面中取消。"
          : role.description || "暂无角色说明"}
      </p>

      <div className="mt-5 space-y-5">
        {permissionGroups.map((group) => (
          <div
            key={`${role.code}-${group.name}`}
            className="rounded-4 border-3 border-dashed border-slate-200 p-4"
          >
            <div className="mb-3 text-base font-extrabold text-slate-900">
              {group.name}
            </div>
            <Checkbox.Group
              value={selectedPermissions}
              disabled={readonly}
              onChange={(values) => onChange?.(values.map(String))}
              className="grid gap-3"
            >
              {group.items.map((permission) => (
                <Checkbox key={permission.code} value={permission.code}>
                  <span className="text-base text-slate-700">
                    {permission.name}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {permission.code}
                  </span>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
        ))}
      </div>
    </Card>
  );
}
