/*
模块：学习总结页面
定位：当前登录用户自己的多篇学习总结列表，支持分页、新增、查看、编辑和删除
数据流：useSummaryStore.refreshList() -> 表格列表；openView/openEdit 拉详情；submitForm 保存
*/
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tabs,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Permission } from "../components/Permission";
import { Card, PaginationBar } from "../components/ui";
import { MarkdownRenderer } from "../markdown";
import { PERMISSIONS } from "../permissions";
import { useSummaryStore } from "../stores/summary-store";
import type { SummaryFormValue, SummaryListItem } from "../types";

const DEFAULT_SUMMARY_FORM: SummaryFormValue = {
  title: "",
  content: "",
};

const SUMMARY_TABLE_SCROLL = { x: 900 };

export function SummaryPage() {
  const [form] = Form.useForm<SummaryFormValue>();
  const previewContent = Form.useWatch("content", form);
  const {
    data,
    detail,
    loading,
    detailLoading,
    formOpen,
    formLoading,
    editingId,
    viewingId,
    draftKeyword,
    setDraftKeyword,
    refreshList,
    updateQuery,
    resetFilters,
    openCreate,
    openEdit,
    openView,
    closeForm,
    closeView,
    submitForm,
    deleteById,
  } = useSummaryStore(
    useShallow((state) => ({
      data: state.data,
      detail: state.detail,
      loading: state.loading,
      detailLoading: state.detailLoading,
      formOpen: state.formOpen,
      formLoading: state.formLoading,
      editingId: state.editingId,
      viewingId: state.viewingId,
      draftKeyword: state.draftKeyword,
      setDraftKeyword: state.setDraftKeyword,
      refreshList: state.refreshList,
      updateQuery: state.updateQuery,
      resetFilters: state.resetFilters,
      openCreate: state.openCreate,
      openEdit: state.openEdit,
      openView: state.openView,
      closeForm: state.closeForm,
      closeView: state.closeView,
      submitForm: state.submitForm,
      deleteById: state.deleteById,
    })),
  );

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const submitSearch = () => {
    void updateQuery((prev) => ({
      ...prev,
      keyword: draftKeyword.trim(),
      page: 1,
    }));
  };

  const handleOpenCreate = () => {
    form.setFieldsValue(DEFAULT_SUMMARY_FORM);
    openCreate();
  };

  const handleOpenEdit = useCallback(async (id: number) => {
    const summary = await openEdit(id);
    if (!summary) return;

    form.setFieldsValue({
      title: summary.title,
      content: summary.content,
    });
  }, [form, openEdit]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await submitForm(values);
  };

  const columns = useMemo<ColumnsType<SummaryListItem>>(
    () => [
      {
        title: "标题",
        dataIndex: "title",
        key: "title",
        width: "30%",
        ellipsis: true,
        render: (value) => <span className="list-title">{value}</span>,
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        key: "updated_at",
        width: "22%",
        render: (value) => <span className="list-meta">{value}</span>,
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        key: "created_at",
        width: "22%",
        render: (value) => <span className="list-meta">{value}</span>,
      },
      {
        title: "操作",
        key: "actions",
        width: "18%",
        render: (_, item) => (
          <Space className="list-actions" size={0} wrap>
            <Button
              type="link"
              className="list-action"
              icon={<EyeOutlined />}
              onClick={() => {
                void openView(item.id);
              }}
            >
              查看
            </Button>
            <Permission code={PERMISSIONS.SUMMARY_UPDATE}>
              <Button
                type="link"
                className="list-action"
                icon={<EditOutlined />}
                onClick={() => {
                  void handleOpenEdit(item.id);
                }}
              >
                编辑
              </Button>
            </Permission>
            <Permission code={PERMISSIONS.SUMMARY_DELETE}>
              <Popconfirm
                title={`确认删除学习总结“${item.title}”吗？`}
                onConfirm={() => {
                  void deleteById(item.id);
                }}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  danger
                  type="link"
                  className="list-action list-action--danger"
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              </Popconfirm>
            </Permission>
          </Space>
        ),
      },
    ],
    [deleteById, handleOpenEdit, openView],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">
          学习总结
        </h2>
        <Permission code={PERMISSIONS.SUMMARY_CREATE}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
          >
            新增总结
          </Button>
        </Permission>
      </div>

      <Card title="" className="manage-card">
        <div className="mb-5 flex w-fit max-w-full flex-wrap items-center gap-4">
          <Input
            size="large"
            value={draftKeyword}
            placeholder="搜索标题/内容"
            prefix={<SearchOutlined className="text-slate-400" />}
            onChange={(event) => setDraftKeyword(event.target.value)}
            onPressEnter={submitSearch}
            className="w-75! rounded-3.5! border-4! border-slate-300!"
            style={{ height: "57px", padding: "0 16px" }}
          />
          <Button
            size="large"
            icon={<SearchOutlined />}
            onClick={submitSearch}
            className="w-25! rounded-3.5! border-4! border-slate-900! text-slate-900! hover:border-[#222]! hover:text-slate-900!"
          >
            搜索
          </Button>
          <Button
            size="large"
            onClick={() => {
              void resetFilters();
            }}
            className="w-25! rounded-3.5! border-4! border-slate-900! text-slate-900! hover:border-[#222]! hover:text-slate-900!"
          >
            重置
          </Button>
        </div>

        <Table
          rowKey="id"
          dataSource={data?.list ?? []}
          columns={columns}
          loading={loading}
          pagination={false}
          scroll={SUMMARY_TABLE_SCROLL}
          className="course-table-like manage-table summary-list-table"
          locale={{ emptyText: "暂无学习总结" }}
        />

        <PaginationBar
          page={data?.page ?? 1}
          pageSize={data?.pageSize ?? 10}
          total={data?.total ?? 0}
          onPageChange={(page) => {
            void updateQuery((prev) => ({ ...prev, page }));
          }}
          onPageSizeChange={(pageSize) =>
            void updateQuery((prev) => ({ ...prev, pageSize, page: 1 }))
          }
        />
      </Card>

      <Modal
        open={Boolean(viewingId)}
        title={detail?.title ?? "学习总结详情"}
        onCancel={closeView}
        footer={null}
        width={920}
        centered
        className="manage-modal"
        loading={detailLoading}
      >
        <div className="summary-panel">
          <MarkdownRenderer content={detail?.content ?? ""} />
        </div>
      </Modal>

      <Modal
        open={formOpen}
        title={editingId ? "编辑学习总结" : "新增学习总结"}
        onCancel={() => !formLoading && closeForm()}
        onOk={handleSubmit}
        confirmLoading={formLoading}
        okText="保存"
        cancelText="取消"
        centered
        width={980}
        destroyOnHidden
        className="manage-modal"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_SUMMARY_FORM}
          className="pt-4"
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input placeholder="请输入学习总结标题" />
          </Form.Item>
          <Tabs
            items={[
              {
                key: "edit",
                label: "编辑",
                children: (
                  <Form.Item
                    name="content"
                    rules={[{ required: true, message: "请输入总结内容" }]}
                  >
                    <Input.TextArea
                      placeholder="支持 Markdown，例如：# 本周总结"
                      rows={15}
                    />
                  </Form.Item>
                ),
              },
              {
                key: "preview",
                label: "预览",
                children: (
                  <div className="summary-panel min-h-90 rounded-4 border-3 border-dashed border-slate-200">
                    <MarkdownRenderer
                      content={previewContent || "暂无内容"}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
}
