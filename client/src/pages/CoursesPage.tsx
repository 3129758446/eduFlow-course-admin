/* 
模块：课程管理页面
定位：列表/筛选/分页/排序 + 新增/编辑/删除/发布 交互聚合页
数据流：由 useCourseStore 统一管理；表单通过 antd Modal + Form 完成校验与提交
用法：通过 shallow 选择最小状态切片，事件直接调用 store 方法
学习要点：删除后依据总数与页码计算 pageAfterDelete，避免空页
*/
import {
  AppstoreOutlined,
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
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { COURSE_STATUS_TEXT, DEFAULT_COURSE_FORM } from "../constants";
import { Permission } from "../components/Permission";
import { Card, PaginationBar } from "../components/ui";
import {
  createCourseCategory,
  deleteCourseCategory,
  updateCourseCategory,
} from "../api";
import { PERMISSIONS } from "../permissions";
import { useAuthStore } from "../stores/auth-store";
import { useCourseStore } from "../stores/course-store";
import type { Course, CourseCategory, CourseFormValue } from "../types";
import { appErrorMessage, parseMaybeChinese } from "../utils/text";

// 课程管理页面
export function CoursesPage() {
  const [form] = Form.useForm<CourseFormValue>();
  const [categoryForm] = Form.useForm<{ name: string }>();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CourseCategory | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const setGlobalError = useAuthStore((state) => state.setGlobalError);
  const canOperateCourse = useAuthStore((state) =>
    state.hasAnyPermission([
      PERMISSIONS.COURSES_UPDATE,
      PERMISSIONS.COURSES_DELETE,
    ]),
  );
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
    loadCategories,
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
      loadCategories: state.loadCategories,
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
  const handleOpenEdit = useCallback(async (id: number) => {
    // 编辑先拉详情再回填表单，保证弹窗里显示的是服务端最新数据。
    const detail = await openEdit(id); // 异步打开编辑弹窗，获取课程详情。
    if (!detail) {
      return;
    }
    // 编辑时回填表单数据，避免用户手动修改后提交时丢失。
    form.setFieldsValue({
      name: detail.name,
      description: detail.description,
      instructor: detail.instructor,
      category: detail.category,
      category_id: detail.category_id,
      status: detail.status,
      lesson_count: detail.lesson_count,
    });
  }, [form, openEdit]);

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

  const handleOpenCategoryModal = useCallback(() => {
    setCategoryModalOpen(true);
    setEditingCategory(null);
    categoryForm.resetFields();
    void loadCategories();
  }, [categoryForm, loadCategories]);

  const handleSearchCategory = useCallback(() => {
    categoryForm.setFields([{ name: "name", errors: [] }]);
    void loadCategories(String(categoryForm.getFieldValue("name") ?? ""));
  }, [categoryForm, loadCategories]);

  const handleEditCategory = useCallback((category: CourseCategory) => {
    setEditingCategory(category);
    categoryForm.setFieldsValue({ name: parseMaybeChinese(category.name) });
    categoryForm.setFields([{ name: "name", errors: [] }]);
  }, [categoryForm]);

  const handleSubmitCategory = useCallback(async () => {
    try {
      const values = await categoryForm.validateFields();
      setCategorySubmitting(true);
      if (editingCategory) {
        await updateCourseCategory(editingCategory.id, values);
      } else {
        await createCourseCategory(values);
      }
      categoryForm.resetFields();
      setEditingCategory(null);
      await loadCategories();
      await updateQuery((prev) => ({ ...prev }));
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }
      setGlobalError(appErrorMessage(error));
    } finally {
      setCategorySubmitting(false);
    }
  }, [categoryForm, editingCategory, loadCategories, setGlobalError, updateQuery]);

  const handleDeleteCategory = useCallback(async (category: CourseCategory) => {
    try {
      await deleteCourseCategory(category.id);
      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
        categoryForm.resetFields();
      }
      await loadCategories(String(categoryForm.getFieldValue("name") ?? ""));
      if (query.categoryId === category.id) {
        await updateQuery((prev) => ({ ...prev, categoryId: "", page: 1 }));
      }
    } catch (error) {
      setGlobalError(appErrorMessage(error));
    }
  }, [categoryForm, editingCategory, loadCategories, query.categoryId, setGlobalError, updateQuery]);

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
            {/* 编辑按钮，仅对有更新权限的用户可见。 */}
            <Permission code={PERMISSIONS.COURSES_UPDATE}>
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
            </Permission>
            {/* 发布/下架按钮，仅对有更新权限的用户可见。 */}
            <Permission code={PERMISSIONS.COURSES_UPDATE}>
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
            </Permission>
            <Permission code={PERMISSIONS.COURSES_DELETE}>
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
            </Permission>
          </Space>
        ),
      },
    ],
    [deleteCourseById, handleOpenEdit, toggleCourseStatusById, updateQuery],
  );
  // 过滤出当前用户可见的列，避免显示无权限的列。
  const visibleColumns = useMemo(
    () =>
      canOperateCourse
        ? columns
        : columns.filter((column) => column.key !== "actions"),
    [canOperateCourse, columns],
  );
  const categoryColumns = useMemo<ColumnsType<CourseCategory>>(
    () => [
      {
        title: "分类名",
        dataIndex: "name",
        key: "name",
        render: (value) => parseMaybeChinese(value || "-"),
      },
      {
        title: "课程数量",
        dataIndex: "course_count",
        key: "course_count",
        width: 120,
      },
      {
        title: "操作",
        key: "actions",
        width: 180,
        render: (_, category) => (
          <Space size={0}>
            <Button
              type="link"
              className="list-action"
              icon={<EditOutlined />}
              onClick={() => handleEditCategory(category)}
            >
              编辑
            </Button>
            <Popconfirm
              title={`确认删除课程分类“${parseMaybeChinese(category.name)}”吗？`}
              disabled={category.course_count > 0}
              onConfirm={() => handleDeleteCategory(category)}
              okText="确认"
              cancelText="取消"
            >
              <Tooltip title={category.course_count > 0 ? "已有课程使用，不能删除" : ""}>
                <Button
                  danger
                  type="link"
                  className="list-action list-action--danger"
                  disabled={category.course_count > 0}
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDeleteCategory, handleEditCategory],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">课程管理</h2>
        <Space wrap>
          <Permission code={PERMISSIONS.COURSES_UPDATE}>
            <Button
              icon={<AppstoreOutlined />}
              onClick={handleOpenCategoryModal}
              className="manage-action-button text-lg font-bold text-slate-900"
            >
              课程分类
            </Button>
          </Permission>
          <Permission code={PERMISSIONS.COURSES_CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
            >
              新增课程
            </Button>
          </Permission>
        </Space>
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
            value={query.categoryId || undefined}
            placeholder="全部分类"
            allowClear
            className="w-45! rounded-3.5! border-4! border-slate-300!"
            onOpenChange={(open) => {
              if (open) void loadCategories();
            }}
            onChange={(value) =>
              void updateQuery((prev) => ({
                ...prev,
                categoryId: value ?? "",
                category: "",
                page: 1,
              }))
            }
            options={categories.map((category) => ({
              value: category.id,
              label: parseMaybeChinese(category.name),
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
          columns={visibleColumns}
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
        open={categoryModalOpen}
        title="课程分类"
        footer={null}
        onCancel={() => {
          if (!categorySubmitting) {
            setCategoryModalOpen(false);
            setEditingCategory(null);
            categoryForm.resetFields();
            // 弹窗查询复用 categories 状态，关闭时恢复全量，避免污染课程筛选/表单下拉。
            void loadCategories();
          }
        }}
        centered
        destroyOnHidden
        className="manage-modal"
        width={720}
      >
        <Form
          form={categoryForm}
          layout="inline"
          className="mb-5 flex! gap-3 pt-4"
        >
          <Form.Item
            name="name"
            className="min-w-0 flex-1"
            validateTrigger={[]}
            rules={[{ required: true, message: "请输入分类名称" }]}
          >
            <Input
              placeholder="请输入分类名称"
              maxLength={100}
              onPressEnter={handleSearchCategory}
            />
          </Form.Item>
          <Form.Item className="m-0!">
            <Button htmlType="button" icon={<SearchOutlined />} onClick={handleSearchCategory}>
              查询
            </Button>
          </Form.Item>
          <Form.Item className="m-0!">
            <Button
              type="primary"
              htmlType="button"
              onClick={handleSubmitCategory}
              loading={categorySubmitting}
              icon={editingCategory ? <EditOutlined /> : <PlusOutlined />}
            >
              {editingCategory ? "保存" : "新增"}
            </Button>
          </Form.Item>
          {editingCategory ? (
            <Form.Item className="m-0!">
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  categoryForm.resetFields();
                }}
              >
                取消
              </Button>
            </Form.Item>
          ) : null}
        </Form>
        <Table
          rowKey="id"
          dataSource={categories}
          columns={categoryColumns}
          pagination={{
            pageSize: 10,
            size: "small",
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 项`,
          }}
          scroll={{ y: 500 }}
          size="middle"
          locale={{ emptyText: "暂无课程分类" }}
        />
      </Modal>

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
            <Form.Item label="分类" name="category_id">
              <Select
                className="manage-form-select w-full! rounded-3.5! border-4! "
                placeholder="请选择课程分类"
                onOpenChange={(open) => {
                  if (open) void loadCategories();
                }}
                options={categories.map((category) => ({
                  value: category.id,
                  label: parseMaybeChinese(category.name),
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
