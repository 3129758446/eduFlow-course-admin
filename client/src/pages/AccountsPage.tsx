/*
模块：账号管理页
定位：admin 用于维护账号、切换账号角色，并配置教师/学生/自定义角色的动态权限
*/
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAccount,
  createRole,
  deleteAccount,
  deleteRole,
  fetchAccounts,
  fetchPermissionGroups,
  fetchRoles,
  updateAccountRole,
  updateRoleInfo,
  updateRolePermissions,
} from "../api";
import { Permission } from "../components/Permission";
import { Card } from "../components/ui";
import { PERMISSIONS, type PermissionCode } from "../permissions";
import type { AccountUser, PermissionGroup, Role } from "../types";
import { appErrorMessage, parseMaybeChinese } from "../utils/text";

type AccountFormValue = {
  username: string;
  name: string;
  role: string;
};

type RoleFormValue = {
  name: string;
  description?: string;
};

type AccountsPageProps = {
  initialTab?: "accounts" | "roles";
};

function displayRoleCode(role: Role) {
  if (!role.builtin) return "custom";
  return role.code;
}

export function AccountsPage({ initialTab = "accounts" }: AccountsPageProps) {
  const [form] = Form.useForm<AccountFormValue>();
  const [roleForm] = Form.useForm<RoleFormValue>();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [permissionRole, setPermissionRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionCode[]>([]);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [deletingRoleCode, setDeletingRoleCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);

  const roleNameMap = useMemo(
    () => Object.fromEntries(roles.map((role) => [role.code, role.name])),
    [roles],
  );
  const manageableRoles = useMemo(
    () => roles.filter((role) => role.code !== "admin"),
    [roles],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountList, roleList, groups] = await Promise.all([
        fetchAccounts(),
        fetchRoles(),
        fetchPermissionGroups(),
      ]);
      setAccounts(accountList);
      setRoles(roleList);
      setPermissionGroups(groups);
      setDraftRoles(
        Object.fromEntries(accountList.map((account) => [account.id, account.role])),
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

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const refreshRoles = useCallback(async () => {
    setRoles(await fetchRoles());
  }, []);

  const handleTabChange = useCallback((key: string) => {
    const nextTab = key as "accounts" | "roles";
    setActiveTab(nextTab);
    navigate(nextTab === "roles" ? "/permissions" : "/accounts");
  }, [navigate]);

  const handleSaveRole = useCallback(async (account: AccountUser) => {
    const nextRole = draftRoles[account.id];
    if (!nextRole || nextRole === account.role) return;

    setSavingId(account.id);
    try {
      const updated = await updateAccountRole(account.id, nextRole);
      setAccounts((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      await refreshRoles();
      message.success("角色已更新");
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }, [draftRoles, refreshRoles]);

  const handleCreateAccount = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      const created = await createAccount(values);
      setAccounts((prev) => [...prev, created]);
      setDraftRoles((prev) => ({ ...prev, [created.id]: created.role }));
      await refreshRoles();
      setCreateOpen(false);
      form.resetFields();
      message.success("账号已创建，初始密码为 123456");
    } catch (error) {
      if (error instanceof Error) {
        message.error(appErrorMessage(error));
      }
    } finally {
      setCreating(false);
    }
  }, [form, refreshRoles]);

  const handleDeleteAccount = useCallback(async (account: AccountUser) => {
    setDeletingId(account.id);
    try {
      await deleteAccount(account.id);
      setAccounts((prev) => prev.filter((item) => item.id !== account.id));
      setDraftRoles((prev) => {
        const next = { ...prev };
        delete next[account.id];
        return next;
      });
      await refreshRoles();
      message.success("账号已删除");
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }, [refreshRoles]);

  const openPermissionModal = useCallback((role: Role) => {
    setPermissionRole(role);
    setSelectedPermissions(role.permissions);
  }, []);

  const handlePermissionCheck = useCallback((
    group: PermissionGroup,
    code: PermissionCode,
    checked: boolean,
  ) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      const viewPermission = group.permissions.find((permission) =>
        permission.code.endsWith(":view"),
      )?.code;

      if (checked) {
        next.add(code);
        if (viewPermission && code !== viewPermission) {
          next.add(viewPermission);
        }
      } else if (code === viewPermission) {
        group.permissions.forEach((permission) => next.delete(permission.code));
      } else {
        next.delete(code);
      }

      return [...next];
    });
  }, []);

  const handleSavePermissions = useCallback(async () => {
    if (!permissionRole) return;

    setPermissionSaving(true);
    try {
      const updated = await updateRolePermissions(permissionRole.code, selectedPermissions);
      setRoles((prev) =>
        prev.map((role) => (role.code === updated.code ? updated : role)),
      );
      setPermissionRole(null);
      message.success("角色权限已更新");
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setPermissionSaving(false);
    }
  }, [permissionRole, selectedPermissions]);

  const openCreateRoleModal = useCallback(() => {
    setEditingRole(null);
    roleForm.resetFields();
    setRoleModalOpen(true);
  }, [roleForm]);

  const openEditRoleModal = useCallback((role: Role) => {
    setEditingRole(role);
    roleForm.setFieldsValue({
      name: parseMaybeChinese(role.name),
      description: parseMaybeChinese(role.description),
    });
    setRoleModalOpen(true);
  }, [roleForm]);

  const handleSaveRoleInfo = useCallback(async () => {
    try {
      const values = await roleForm.validateFields();
      setRoleSaving(true);
      const saved = editingRole
        ? await updateRoleInfo(editingRole.code, values)
        : await createRole({ ...values, permissions: [] });

      setRoles((prev) =>
        editingRole
          ? prev.map((role) => (role.code === saved.code ? saved : role))
          : [...prev, saved],
      );
      setRoleModalOpen(false);
      setEditingRole(null);
      roleForm.resetFields();
      message.success(editingRole ? "角色信息已更新" : "角色已创建");
    } catch (error) {
      if (error instanceof Error) {
        message.error(appErrorMessage(error));
      }
    } finally {
      setRoleSaving(false);
    }
  }, [editingRole, roleForm]);

  const handleDeleteRole = useCallback(async (role: Role) => {
    setDeletingRoleCode(role.code);
    try {
      await deleteRole(role.code);
      setRoles((prev) => prev.filter((item) => item.code !== role.code));
      message.success("角色已删除");
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setDeletingRoleCode(null);
    }
  }, []);

  const accountColumns = useMemo<ColumnsType<AccountUser>>(
    () => [
      {
        title: "账号",
        dataIndex: "username",
        key: "username",
        width: "18%",
        render: (value) => <span className="list-title">{value}</span>,
      },
      {
        title: "姓名",
        dataIndex: "name",
        key: "name",
        width: "18%",
        render: (value) => parseMaybeChinese(value),
      },
      {
        title: "当前角色",
        dataIndex: "role",
        key: "role",
        width: "18%",
        render: (value) => (
          <Tag className="list-chip list-chip--blue">
            {parseMaybeChinese(roleNameMap[value] ?? value)}
          </Tag>
        ),
      },
      {
        title: "修改角色",
        key: "roleEdit",
        width: "26%",
        render: (_, account) => (
          <Permission code={PERMISSIONS.ACCOUNTS_UPDATE_ROLE}>
            {account.role === "admin" ? (
              <span className="text-slate-400">管理员不可修改</span>
            ) : (
              <Select
                value={draftRoles[account.id] ?? account.role}
                className="manage-form-select w-48!"
                options={manageableRoles.map((role) => ({
                  value: role.code,
                  label: parseMaybeChinese(role.name),
                }))}
                onChange={(value) =>
                  setDraftRoles((prev) => ({ ...prev, [account.id]: value }))
                }
              />
            )}
          </Permission>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: "20%",
        render: (_, account) => {
          const canManage = account.role !== "admin";
          const changed = (draftRoles[account.id] ?? account.role) !== account.role;

          return (
            <Space className="list-actions" size={0} wrap>
              <Permission code={PERMISSIONS.ACCOUNTS_UPDATE_ROLE}>
                <Button
                  type="link"
                  icon={<SaveOutlined />}
                  disabled={!canManage || !changed}
                  loading={savingId === account.id}
                  onClick={() => {
                    void handleSaveRole(account);
                  }}
                >
                  保存
                </Button>
              </Permission>
              <Permission code={PERMISSIONS.ACCOUNTS_UPDATE_ROLE}>
                <Popconfirm
                  title={`确认删除账号“${account.username}”吗？`}
                  disabled={!canManage}
                  onConfirm={() => {
                    void handleDeleteAccount(account);
                  }}
                  okButtonProps={{ loading: deletingId === account.id }}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button
                    danger
                    type="link"
                    icon={<DeleteOutlined />}
                    disabled={!canManage}
                    loading={deletingId === account.id}
                  >
                    删除
                  </Button>
                </Popconfirm>
              </Permission>
            </Space>
          );
        },
      },
    ],
    [
      deletingId,
      draftRoles,
      handleDeleteAccount,
      handleSaveRole,
      manageableRoles,
      roleNameMap,
      savingId,
    ],
  );

  const roleColumns = useMemo<ColumnsType<Role>>(
    () => [
      {
        title: "角色",
        dataIndex: "name",
        key: "name",
        width: "22%",
        render: (value, role) => (
          <div>
            <span className="list-title">{parseMaybeChinese(value)}</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="list-subtitle" title={role.code}>
                {displayRoleCode(role)}
              </span>
              <Tag className={role.builtin ? "list-status list-status--success" : "list-chip list-chip--blue"}>
                {role.builtin ? "系统默认" : "自定义"}
              </Tag>
            </div>
          </div>
        ),
      },
      {
        title: "说明",
        dataIndex: "description",
        key: "description",
        width: "28%",
        render: (value) => parseMaybeChinese(value || "-"),
      },
      {
        title: "用户数量",
        key: "userCount",
        width: "14%",
        render: (_, role) => (
          <Tag className="list-chip list-chip--blue">{role.userCount} 个</Tag>
        ),
      },
      {
        title: "权限数量",
        key: "permissionCount",
        width: "14%",
        render: (_, role) => (
          <Tag className={role.editable ? "list-chip list-chip--blue" : "list-status list-status--success"}>
            {role.editable ? `${role.permissions.length} 项` : "全部权限"}
          </Tag>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: "22%",
        render: (_, role) => {
          if (!role.editable) {
            return <span className="text-slate-400">管理员权限不可修改</span>;
          }

          return (
            <Space className="list-actions" size={0} wrap>
              <Button
                type="link"
                icon={<SettingOutlined />}
                onClick={() => openPermissionModal(role)}
              >
                配置权限
              </Button>
              {!role.builtin ? (
                <>
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => openEditRoleModal(role)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title={
                      role.userCount > 0
                        ? `该角色下还有 ${role.userCount} 个用户，请先转移用户`
                        : `确认删除角色“${parseMaybeChinese(role.name)}”吗？`
                    }
                    disabled={!role.deletable || role.userCount > 0}
                    onConfirm={() => {
                      void handleDeleteRole(role);
                    }}
                    okButtonProps={{ loading: deletingRoleCode === role.code }}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button
                      danger
                      type="link"
                      icon={<DeleteOutlined />}
                      disabled={!role.deletable || role.userCount > 0}
                      loading={deletingRoleCode === role.code}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [deletingRoleCode, handleDeleteRole, openEditRoleModal, openPermissionModal],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">
          {activeTab === "roles" ? "权限管理" : "账号管理"}
        </h2>
        <Space wrap>
          {activeTab === "accounts" ? (
            <Permission code={PERMISSIONS.ACCOUNTS_UPDATE_ROLE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.setFieldsValue({ role: "student" });
                  setCreateOpen(true);
                }}
                className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
              >
                新增账号
              </Button>
            </Permission>
          ) : (
            <Permission code={PERMISSIONS.ACCOUNTS_UPDATE_ROLE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateRoleModal}
                className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
              >
                新增角色
              </Button>
            </Permission>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void loadData();
            }}
            className="manage-action-button bg-white text-lg font-bold text-slate-900"
          >
            刷新
          </Button>
        </Space>
      </div>

      <Card title="" className="manage-card">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: "accounts",
              label: "账号管理",
              children: (
                <div className="space-y-5">
                  <Table
                    rowKey="id"
                    dataSource={accounts}
                    columns={accountColumns}
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 820 }}
                    className="course-table-like manage-table"
                    locale={{ emptyText: "暂无账号数据" }}
                  />
                </div>
              ),
            },
            {
              key: "roles",
              label: "角色权限",
              children: (
                <Table
                  rowKey="code"
                  dataSource={roles}
                  columns={roleColumns}
                  loading={loading}
                  pagination={false}
                  scroll={{ x: 920 }}
                  className="course-table-like manage-table"
                  locale={{ emptyText: "暂无角色数据" }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={createOpen}
        title="新增教师/学生/自定义账号"
        onCancel={() => {
          if (!creating) {
            setCreateOpen(false);
            form.resetFields();
          }
        }}
        onOk={handleCreateAccount}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        centered
        destroyOnHidden
        className="manage-modal"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: "student" }}
          className="pt-4"
        >
          <Form.Item
            label="账号"
            name="username"
            rules={[{ required: true, message: "请输入账号" }]}
          >
            <Input placeholder="请输入登录账号" />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="请输入用户姓名" />
          </Form.Item>
          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: "请选择角色" }]}
          >
            <Select
              className="manage-form-select w-full!"
              options={manageableRoles.map((role) => ({
                value: role.code,
                label: parseMaybeChinese(role.name),
              }))}
            />
          </Form.Item>
          <div className="rounded-4 border-3 border-dashed border-slate-200 p-4 text-base text-slate-500">
            新账号初始密码固定为 123456，用户登录后可在右上角修改密码。
          </div>
        </Form>
      </Modal>

      <Modal
        open={roleModalOpen}
        title={editingRole ? "编辑自定义角色" : "新增自定义角色"}
        onCancel={() => {
          if (!roleSaving) {
            setRoleModalOpen(false);
            setEditingRole(null);
            roleForm.resetFields();
          }
        }}
        onOk={handleSaveRoleInfo}
        confirmLoading={roleSaving}
        okText={editingRole ? "保存" : "创建"}
        cancelText="取消"
        centered
        destroyOnHidden
        className="manage-modal"
      >
        <Form form={roleForm} layout="vertical" className="pt-4">
          <Form.Item
            label="角色名称"
            name="name"
            rules={[
              { required: true, message: "请输入角色名称" },
              { max: 30, message: "角色名称不能超过 30 个字符" },
            ]}
          >
            <Input placeholder="例如：助教、班主任、教务老师" />
          </Form.Item>
          <Form.Item label="角色说明" name="description">
            <Input.TextArea
              rows={3}
              placeholder="可选，用于说明这个角色适合哪些账号"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(permissionRole)}
        title={`配置权限 - ${parseMaybeChinese(permissionRole?.name ?? "")}`}
        onCancel={() => {
          if (!permissionSaving) {
            setPermissionRole(null);
          }
        }}
        onOk={handleSavePermissions}
        confirmLoading={permissionSaving}
        okText="保存"
        cancelText="取消"
        width={860}
        centered
        destroyOnHidden
        className="manage-modal"
      >
        <div className="space-y-5 pt-2">
          {permissionGroups.map((group) => (
            <section
              key={group.module}
              className="rounded-4 border-3 border-dashed border-slate-200 p-4"
            >
              <h3 className="m-0 mb-3 text-xl font-extrabold text-slate-900">
                {parseMaybeChinese(group.moduleName)}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {group.permissions.map((permission) => (
                  <Checkbox
                    key={permission.code}
                    checked={selectedPermissions.includes(permission.code)}
                    onChange={(event) =>
                      handlePermissionCheck(
                        group,
                        permission.code,
                        event.target.checked,
                      )
                    }
                  >
                    <span className="font-semibold text-slate-700">
                      {parseMaybeChinese(permission.name)}
                    </span>
                    <span className="ml-2 text-sm text-slate-400">
                      {permission.code}
                    </span>
                  </Checkbox>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Modal>
    </div>
  );
}
