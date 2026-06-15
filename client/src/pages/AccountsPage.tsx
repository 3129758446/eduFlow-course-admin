/*
模块：账号管理页
定位：admin 用于维护账号、切换账号角色和删除非管理员账号。
说明：权限配置已经拆到 PermissionsPage，避免一个页面用状态同步两个路由。
*/
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  fetchRoles,
  updateAccountRole,
} from "../api";
import { Permission } from "../components/Permission";
import { Card } from "../components/ui";
import { PERMISSIONS } from "../permissions";
import type { AccountUser, Role } from "../types";
import { appErrorMessage, parseMaybeChinese } from "../utils/text";

type AccountFormValue = {
  username: string;
  name: string;
  role: string;
};

async function fetchAccountPageData() {
  const [accountList, roleList] = await Promise.all([
    fetchAccounts(),
    fetchRoles(),
  ]);
  return { accountList, roleList };
}

export function AccountsPage() {
  const [form] = Form.useForm<AccountFormValue>();
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const roleNameMap = useMemo(
    () => Object.fromEntries(roles.map((role) => [role.code, role.name])),
    [roles],
  );
  const manageableRoles = useMemo(
    () => roles.filter((role) => role.code !== "admin"),
    [roles],
  );

  const applyPageData = useCallback((
    accountList: AccountUser[],
    roleList: Role[],
  ) => {
    setAccounts(accountList);
    setRoles(roleList);
    setDraftRoles(
      Object.fromEntries(accountList.map((account) => [account.id, account.role])),
    );
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      try {
        // 首次加载不在 effect 同步阶段 setState，避免触发 React 的 set-state-in-effect 告警。
        const { accountList, roleList } = await fetchAccountPageData();
        if (!ignore) {
          applyPageData(accountList, roleList);
        }
      } catch (error) {
        if (!ignore) {
          message.error(appErrorMessage(error));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      ignore = true;
    };
  }, [applyPageData]);

  // 手动刷新由用户触发，可以立即进入 loading 态。
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { accountList, roleList } = await fetchAccountPageData();
      applyPageData(accountList, roleList);
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [applyPageData]);

  const refreshRoles = useCallback(async () => {
    setRoles(await fetchRoles());
  }, []);

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

  const columns = useMemo<ColumnsType<AccountUser>>(
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

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">账号管理</h2>
        <Space wrap>
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
        <Table
          rowKey="id"
          dataSource={accounts}
          columns={columns}
          loading={loading}
          pagination={false}
          scroll={{ x: 820 }}
          className="course-table-like manage-table"
          locale={{ emptyText: "暂无账号数据" }}
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
    </div>
  );
}
