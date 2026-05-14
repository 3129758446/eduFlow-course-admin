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
  UploadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadProps } from "antd";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { uploadSummaryImage } from "../api";
import { Permission } from "../components/Permission";
import { Card, PaginationBar } from "../components/ui";
import { PERMISSIONS } from "../permissions";
import { useSummaryStore } from "../stores/summary-store";
import type { SummaryFormValue, SummaryListItem } from "../types";
import { appErrorMessage } from "../utils/text";

const MarkdownRenderer = lazy(() =>
  import("../markdown").then((module) => ({ default: module.MarkdownRenderer })),
);

const DEFAULT_SUMMARY_FORM: SummaryFormValue = {
  title: "",
  content: "",
};

const SUMMARY_TABLE_SCROLL = { x: 900 };

// 学习总结页面
export function SummaryPage() {
  const [form] = Form.useForm<SummaryFormValue>(); // 表单实例
  // useWatch 监听内容变化
  const previewContent = Form.useWatch("content", form); // 监听内容变化
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
      data: state.data, // 列表数据
      detail: state.detail, // 详情数据
      loading: state.loading, // 表格加载中
      detailLoading: state.detailLoading, // 详情加载中
      formOpen: state.formOpen, // 表单打开
      formLoading: state.formLoading, // 表单加载中
      editingId: state.editingId, // 正在编辑的 ID
      viewingId: state.viewingId, // 详情打开
      draftKeyword: state.draftKeyword, // 搜索关键词
      setDraftKeyword: state.setDraftKeyword, // 设置搜索关键词
      refreshList: state.refreshList, // 重新拉取列表
      updateQuery: state.updateQuery, // 更新查询参数
      resetFilters: state.resetFilters, // 重置查询参数
      openCreate: state.openCreate, // 新增表单打开
      openEdit: state.openEdit, // 编辑表单打开
      openView: state.openView, // 详情打开
      closeForm: state.closeForm, // 表单关闭
      closeView: state.closeView, // 详情关闭
      submitForm: state.submitForm, // 保存表单
      deleteById: state.deleteById, // 删除
    })),
  );

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // 搜索学习总结
  const submitSearch = () => {
    void updateQuery((prev) => ({
      ...prev,
      keyword: draftKeyword.trim(),
      page: 1,
    }));
  };

  // 新增学习总结
  const handleOpenCreate = () => {
    form.setFieldsValue(DEFAULT_SUMMARY_FORM); // 写入默认值
    openCreate(); // 打开新增弹窗
  };

  // 编辑学习总结
  const handleOpenEdit = useCallback(async (id: number) => {
    const summary = await openEdit(id); // 打开编辑弹窗
    if (!summary) return;

    form.setFieldsValue({
      title: summary.title,
      content: summary.content,
    });
  }, [form, openEdit]);

  // 查看学习总结
  const handleSubmit = async () => {
    const values = await form.validateFields();
    await submitForm(values);
  };

  const uploadProps = useMemo<UploadProps>(
    () => ({
      accept: "image/png,image/jpeg,image/webp,image/gif",
      showUploadList: false,
      beforeUpload: async (file) => {
        const allowTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
        if (!allowTypes.includes(file.type)) {
          message.error("仅支持 png、jpg、jpeg、webp、gif 图片");
          return Upload.LIST_IGNORE;
        }
        if (file.size > 5 * 1024 * 1024) {
          message.error("图片不能超过 5MB");
          return Upload.LIST_IGNORE;
        }

        try {
          const result = await uploadSummaryImage(file);
          const currentContent = form.getFieldValue("content") || "";
          const imageMarkdown = `![${file.name}](${result.url})`;
          // 上传成功后自动追加 Markdown 图片语法，用户可以继续编辑标题或说明文本。
          form.setFieldValue(
            "content",
            currentContent ? `${currentContent}\n\n${imageMarkdown}` : imageMarkdown,
          );
          message.success("图片已插入总结");
        } catch (error) {
          message.error(appErrorMessage(error));
        }

        return Upload.LIST_IGNORE;
      },
    }),
    [form],
  );

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
                  void deleteById(item.id); // 删除
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
          <Suspense fallback={<div className="text-slate-400">正在加载预览...</div>}>
            <MarkdownRenderer content={detail?.content ?? ""} />
          </Suspense>
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
                  <>
                    <div className="mb-3 flex justify-end">
                      <Upload {...uploadProps}>
                        <Button icon={<UploadOutlined />}>上传图片</Button>
                      </Upload>
                    </div>
                    <Form.Item
                      name="content"
                      rules={[{ required: true, message: "请输入总结内容" }]}
                    >
                      <Input.TextArea
                        placeholder="支持 Markdown，例如：# 本周总结"
                        rows={15}
                      />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "preview",
                label: "预览",
                children: (
                  <div className="summary-panel min-h-90 rounded-4 border-3 border-dashed border-slate-200">
                    <Suspense fallback={<div className="text-slate-400">正在加载预览...</div>}>
                      <MarkdownRenderer
                        content={previewContent || "暂无内容"}
                      />
                    </Suspense>
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
