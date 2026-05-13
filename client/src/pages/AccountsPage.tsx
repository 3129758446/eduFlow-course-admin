/*
模块：账号管理页
定位：admin 用于查看账号列表，新增/删除教师与学生账号，并切换教师/学生角色
数据流：fetchAccounts + fetchRoles -> 表格展示 -> 新增/修改/删除 -> 刷新或局部更新
学习要点：draftRoles 保存“页面临时选择值”，只有点击保存后才真正提交到后端。
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
import { Card } from "../components/ui";
import { Permission } from "../components/Permission";
import { PERMISSIONS } from "../permissions";
import type { AccountUser, Role } from "../types";
import { appErrorMessage, parseMaybeChinese } from "../utils/text";

type AccountFormValue = {
  username: string;
  name: string;
  role: string;
};

// 账号管理页只允许维护教师和学生，admin 是系统账号，前后端都会保护。
const MANAGED_ROLES = ["teacher", "student"];

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
    () => roles.filter((role) => MANAGED_ROLES.includes(role.code)),
    [roles],
  );

  // 账号页需要账号列表和角色列表两份数据：前者渲染表格，后者渲染角色下拉框。
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountList, roleList] = await Promise.all([
        fetchAccounts(),
        fetchRoles(),
      ]);
      setAccounts(accountList);
      setRoles(roleList);
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

  const handleSaveRole = useCallback(async (account: AccountUser) => {
    const nextRole = draftRoles[account.id];
    if (!nextRole || nextRole === account.role) {
      return;
    }

    setSavingId(account.id);
    try {
      const updated = await updateAccountRole(account.id, nextRole);
      setAccounts((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      message.success("角色已更新");
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }, [draftRoles]);

  const handleCreateAccount = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      // 后端会统一写入初始密码 123456，前端不接收密码字段，减少误填和泄漏风险。
      const created = await createAccount(values);
      setAccounts((prev) => [...prev, created]);
      setDraftRoles((prev) => ({ ...prev, [created.id]: created.role }));
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
  }, [form]);

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
      message.success("账号已删除");
    } catch (error) {
      message.error(appErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const columns = useMemo<ColumnsType<AccountUser>>(
    () => [
      {
        title: "账号",
        dataIndex: "username",
        key: "username",
        width: "20%",
        render: (value) => <span className="list-title">{value}</span>,
      },
      {
        title: "姓名",
        dataIndex: "name",
        key: "name",
        width: "20%",
        render: (value) => parseMaybeChinese(value),
      },
      {
        title: "当前角色",
        dataIndex: "role",
        key: "role",
        width: "20%",
        render: (value) => (
          <Tag className="list-chip list-chip--blue">
            {roleNameMap[value] ?? value}
          </Tag>
        ),
      },
      {
        title: "修改角色",
        key: "roleEdit",
        width: "25%",
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
                  label: role.name,
                }))}
                onChange={(value) =>
                  // 只更新页面草稿值，不立即请求后端，避免误操作一选中就生效。
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
        width: "15%",
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
          scroll={{ x: 760 }}
          className="course-table-like manage-table"
          locale={{ emptyText: "暂无账号数据" }}
        />
      </Card>

      <Modal
        open={createOpen}
        title="新增教师/学生账号"
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
                label: role.name,
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
