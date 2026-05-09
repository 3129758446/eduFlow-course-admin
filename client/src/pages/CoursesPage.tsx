/* 
模块：课程管理页面
定位：列表/筛选/分页/排序 + 新增/编辑/删除/发布 交互聚合页
数据流：由 useCourseStore 统一管理；表单通过 antd Modal + Form 完成校验与提交
用法：通过 shallow 选择最小状态切片，事件直接调用 store 方法
学习要点：删除后依据总数与页码计算 pageAfterDelete，避免空页
*/
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { COURSE_STATUS_TEXT, DEFAULT_COURSE_FORM } from "../constants";
import { Card, PaginationBar } from "../components/ui";
import { useAuthStore } from "../stores/auth-store";
import { useCourseStore } from "../stores/course-store";
import type { Course, CourseFormValue } from "../types";
import { parseMaybeChinese } from "../utils/text";

export function CoursesPage() {
  const [form] = Form.useForm<CourseFormValue>();
  const setGlobalError = useAuthStore((state) => state.setGlobalError);
  const {
    data,
    loading,
    categories,
    query,
    draftKeyword,
    formOpen,
    editingId,
    formLoading,
    setDraftKeyword,
    initializePage,
    updateQuery,
    resetFilters,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    deleteCourseById,
    toggleCourseStatusById,
  } = useCourseStore(
    useShallow((state) => ({
      data: state.data,
      loading: state.loading,
      categories: state.categories,
      query: state.query,
      draftKeyword: state.draftKeyword,
      formOpen: state.formOpen,
      editingId: state.editingId,
      formLoading: state.formLoading,
      setDraftKeyword: state.setDraftKeyword,
      initializePage: state.initializePage,
      updateQuery: state.updateQuery,
      resetFilters: state.resetFilters,
      openCreate: state.openCreate,
      openEdit: state.openEdit,
      closeForm: state.closeForm,
      submitForm: state.submitForm,
      deleteCourseById: state.deleteCourseById,
      toggleCourseStatusById: state.toggleCourseStatusById,
    })),
  );

  // 初始化页面数据，包括课程列表和筛选辅助数据
  useEffect(() => {
    void initializePage();
  }, [initializePage]);

  // 清除全局错误信息
  useEffect(() => {
    setGlobalError("");
  }, [setGlobalError]);

  const handleOpenCreate = () => {
    // 新增时先写入默认值，避免复用上一次编辑表单残留的数据。
    form.setFieldsValue(DEFAULT_COURSE_FORM);
    openCreate();
  };

  // 打开编辑弹窗
  // 编辑时先拉详情再回填表单，保证弹窗里显示的是服务端最新数据。
  const handleOpenEdit = async (id: number) => {
    // 编辑先拉详情再回填表单，保证弹窗里显示的是服务端最新数据。
    const detail = await openEdit(id);
    if (!detail) {
      return;
    }

    form.setFieldsValue({
      name: detail.name,
      description: detail.description,
      instructor: detail.instructor,
      category: detail.category,
      status: detail.status,
      lesson_count: detail.lesson_count,
    });
  };

  // 提交表单
  // 新增或编辑课程时，先校验表单，再提交到 store 处理。
  const handleSubmitForm = async () => {
    try {
      // 先走 antd 表单校验，再把合法数据交给 store 统一决定新增还是编辑。
      const formValue = await form.validateFields();
      await submitForm(formValue);
    } catch {
      return;
    }
  };

  // 课程列表列配置
  // 包含课程名称、讲师、分类、课时、操作列（编辑/删除/发布）
  // 点击操作列触发对应事件，如编辑/删除/发布课程。
  const columns = useMemo<ColumnsType<Course>>(
    () => [
      // 列配置集中在 useMemo 内，便于和当前页面行为（编辑/删除/排序）一起维护。
      {
        title: "课程名称",
        dataIndex: "name",
        key: "name",
        width: "25%",
        ellipsis: true,
        render: (_, course) => (
          <div className="w-full py-1">
            <div
              className="list-title block overflow-hidden text-ellipsis whitespace-nowrap"
              title={parseMaybeChinese(course.name)}
            >
              {parseMaybeChinese(course.name)}
            </div>
            <div
              className="list-subtitle mt-1 block overflow-hidden text-ellipsis whitespace-nowrap"
              title={parseMaybeChinese(course.description || "暂无课程描述")}
            >
              {parseMaybeChinese(course.description || "暂无课程描述")}
            </div>
          </div>
        ),
      },
      {
        title: "讲师",
        dataIndex: "instructor",
        key: "instructor",
        width: "10%",
        render: (value) => (
          <span className="list-meta">{parseMaybeChinese(value || "-")}</span>
        ),
      },
      {
        title: "分类",
        dataIndex: "category",
        key: "category",
        width: "10%",
        render: (value) => (
          <Tag className="list-chip list-chip--blue">
            {parseMaybeChinese(value || "未分类")}
          </Tag>
        ),
      },
      {
        title: "课时",
        dataIndex: "lesson_count",
        key: "lesson_count",
        width: "10%",
      },
      {
        title: (
          <button
            className="inline-flex items-center gap-1 text-lg font-extrabold text-slate-900"
            onClick={() =>
              updateQuery((prev) => {
                // 点击表头在升序/降序之间切换，并重置到第一页避免排序后页码越界。
                const nextOrder =
                  prev.sortField === "student_count" &&
                  prev.sortOrder === "descend"
                    ? "ascend"
                    : "descend";
                return {
                  ...prev,
                  sortField: "student_count",
                  sortOrder: nextOrder,
                  page: 1,
                };
              })
            }
            type="button"
          >
            选课人数 <SwapOutlined className="text-slate-400" />
          </button>
        ),
        dataIndex: "student_count",
        key: "student_count",
        width: "10%",
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: "10%",
        render: (value) => (
          <Tag
            className={`list-status ${
              value === "published"
                ? "list-status--success"
                : "list-status--muted"
            }`}
          >
            {COURSE_STATUS_TEXT[value] || value}
          </Tag>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: "25%",
        render: (_, course) => (
          <Space className="list-actions" size={0} wrap>
            <Button
              type="link"
              className="list-action"
              icon={<EditOutlined />}
              onClick={() => {
                void handleOpenEdit(course.id);
              }}
            >
              编辑
            </Button>
            <Popconfirm
              title={
                course.status === "published"
                  ? `确认下架课程“${parseMaybeChinese(course.name)}”吗？`
                  : `确认发布课程“${parseMaybeChinese(course.name)}”吗？`
              }
              onConfirm={async () => {
                await toggleCourseStatusById(course.id);
              }}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" className="list-action">
                {course.status === "published" ? "下架" : "发布"}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`确认删除课程“${parseMaybeChinese(course.name)}”吗？`}
              onConfirm={async () => {
                await deleteCourseById(course.id);
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
          </Space>
        ),
      },
    ],
    [deleteCourseById, toggleCourseStatusById],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">课程管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
        >
          新增课程
        </Button>
      </div>

      <Card title="" className="manage-card">
        {/* 筛选区遵循“搜索词 + 枚举筛选 + 操作按钮”的后台通用布局。 */}
        <div className="mb-8 flex w-fit max-w-full flex-wrap items-center gap-4">
          <Input
            size="large"
            value={draftKeyword}
            placeholder="搜索课程名/讲师"
            prefix={<SearchOutlined className="text-slate-400" />}
            onChange={(event) => setDraftKeyword(event.target.value)}
            onPressEnter={() =>
              // 输入框只维护草稿值，按回车时才真正提交到 query，减少请求次数。
              void updateQuery((prev) => ({
                ...prev,
                keyword: draftKeyword.trim(),
                page: 1,
              }))
            }
            className="w-75! rounded-3.5! border-4! border-slate-300!"
            style={{ height: "57px", padding: "0 16px" }}
          />
          <Select
            size="large"
            value={query.status || undefined}
            placeholder="全部状态"
            allowClear
            className="w-45! rounded-3.5! border-4! border-slate-300!"
            onChange={(value) =>
              void updateQuery((prev) => ({
                ...prev,
                status: value ?? "",
                page: 1,
              }))
            }
            options={[
              { value: "published", label: "已发布" },
              { value: "draft", label: "草稿" },
            ]}
          />
          <Select
            size="large"
            value={query.category || undefined}
            placeholder="全部分类"
            allowClear
            className="w-45! rounded-3.5! border-4! border-slate-300!"
            onChange={(value) =>
              void updateQuery((prev) => ({
                ...prev,
                category: value ?? "",
                page: 1,
              }))
            }
            options={categories.map((category) => ({
              value: category,
              label: parseMaybeChinese(category),
            }))}
          />
          <Button
            size="large"
            icon={<SearchOutlined />}
            onClick={() =>
              void updateQuery((prev) => ({
                ...prev,
                keyword: draftKeyword.trim(),
                page: 1,
              }))
            }
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
          // 分页统一交给底部 PaginationBar，便于保持所有列表页交互一致。
          rowKey="id"
          dataSource={data?.list ?? []}
          columns={columns}
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
          className="course-table-like manage-table"
          locale={{ emptyText: "暂无课程数据" }}
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
        open={formOpen}
        title={editingId ? "编辑课程" : "新增课程"}
        onCancel={() => !formLoading && closeForm()}
        onOk={handleSubmitForm}
        confirmLoading={formLoading}
        okText="保存"
        cancelText="取消"
        centered
        destroyOnHidden
        className="manage-modal"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_COURSE_FORM}
          className="pt-4"
        >
          {/* 表单按“基础信息在上、枚举/数字字段在下”的方式分组，降低阅读成本。 */}
          <div className="grid gap-x-5 md:grid-cols-2">
            <Form.Item
              label="课程名称"
              name="name"
              rules={[{ required: true, message: "请输入课程名称" }]}
              className="md:col-span-2"
            >
              <Input placeholder="请输入课程名称" />
            </Form.Item>
            <Form.Item
              label="课程描述"
              name="description"
              className="md:col-span-2"
            >
              <Input.TextArea placeholder="请输入课程描述" rows={4} />
            </Form.Item>
            <Form.Item label="讲师" name="instructor">
              <Input placeholder="请输入讲师姓名" />
            </Form.Item>
            <Form.Item label="分类" name="category">
              <Select
                className="manage-form-select w-full! rounded-3.5! border-4! "
                placeholder="请选择课程分类"
                options={categories.map((category) => ({
                  value: category,
                  label: parseMaybeChinese(category),
                }))}
              />
            </Form.Item>
            <Form.Item label="课时数" name="lesson_count">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item label="状态" name="status">
              <Select
                className="manage-form-select w-full! rounded-3.5! border-4! "
                placeholder="请选择课程状态"
                options={[
                  { value: "draft", label: "草稿" },
                  { value: "published", label: "已发布" },
                ]}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
