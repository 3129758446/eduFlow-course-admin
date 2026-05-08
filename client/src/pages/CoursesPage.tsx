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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCourse,
  deleteCourse,
  fetchCourseCategories,
  fetchCourseDetail,
  fetchCourses,
  toggleCourseStatus,
  updateCourse,
} from "../api";
import { COURSE_STATUS_TEXT, DEFAULT_COURSE_FORM } from "../constants";
import { Card, PaginationBar } from "../components/ui";
import type {
  Course,
  CourseFormValue,
  CourseListResponse,
  CourseQuery,
} from "../types";
import { pageAfterDelete } from "../utils/pagination";
import { appErrorMessage, parseMaybeChinese } from "../utils/text";

export function CoursesPage({
  setGlobalError,
}: {
  setGlobalError: (value: string) => void;
}) {
  const [data, setData] = useState<CourseListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState<CourseQuery>({
    keyword: "",
    status: "",
    category: "",
    page: 1,
    pageSize: 10,
    sortField: "",
    sortOrder: "",
  });
  const [draftKeyword, setDraftKeyword] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form] = Form.useForm<CourseFormValue>();

  const updateQuery = (updater: (prev: CourseQuery) => CourseQuery) => {
    setLoading(true);
    setQuery(updater);
  };

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchCourses(query);
      setData(result);
      setGlobalError("");
    } catch (error) {
      setGlobalError(appErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query, setGlobalError]);

  useEffect(() => {
    let active = true;
    fetchCourses(query)
      .then((result) => {
        if (!active) return;
        setData(result);
        setGlobalError("");
      })
      .catch((error) => {
        if (active) setGlobalError(appErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, setGlobalError]);

  useEffect(() => {
    fetchCourseCategories()
      .then(setCategories)
      .catch((error) => setGlobalError(appErrorMessage(error)));
  }, [setGlobalError]);

  const openCreate = () => {
    setEditingId(null);
    form.setFieldsValue(DEFAULT_COURSE_FORM);
    setFormOpen(true);
  };

  const openEdit = useCallback(
    async (id: number) => {
      setFormLoading(true);
      setFormOpen(true);
      try {
        const detail = await fetchCourseDetail(id);
        setEditingId(id);
        form.setFieldsValue({
          name: detail.name,
          description: detail.description,
          instructor: detail.instructor,
          category: detail.category,
          status: detail.status,
          lesson_count: detail.lesson_count,
        });
      } catch (error) {
        setGlobalError(appErrorMessage(error));
        setFormOpen(false);
      } finally {
        setFormLoading(false);
      }
    },
    [form, setGlobalError],
  );

  const submitForm = async () => {
    try {
      const formValue = await form.validateFields();
      setFormLoading(true);
      if (editingId) {
        await updateCourse(editingId, formValue);
      } else {
        await createCourse(formValue);
      }
      setFormOpen(false);
      await refreshList();
    } catch (error) {
      if (error instanceof Error) {
        setGlobalError(appErrorMessage(error));
      }
    } finally {
      setFormLoading(false);
    }
  };

  const resetFilters = () => {
    setDraftKeyword("");
    updateQuery((prev) => ({
      ...prev,
      keyword: "",
      status: "",
      category: "",
      page: 1,
    }));
  };

  const handleDeleteCourse = useCallback(
    async (id: number) => {
      try {
        await deleteCourse(id);

        const nextPage = pageAfterDelete({
          page: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
        });

        if (nextPage !== query.page) {
          updateQuery((prev) => ({ ...prev, page: nextPage }));
          return;
        }

        await refreshList();
      } catch (error) {
        setGlobalError(appErrorMessage(error));
      }
    },
    [data?.total, query.page, query.pageSize, refreshList, setGlobalError],
  );

  const columns = useMemo<ColumnsType<Course>>(
    () => [
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
              onClick={() => openEdit(course.id)}
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
                try {
                  await toggleCourseStatus(course.id);
                  await refreshList();
                } catch (error) {
                  setGlobalError(appErrorMessage(error));
                }
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
                await handleDeleteCourse(course.id);
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
    [handleDeleteCourse, openEdit, refreshList, setGlobalError],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">
          课程管理
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
        >
          新增课程
        </Button>
      </div>

      <Card title="" className="manage-card">
        <div className="mb-8 flex w-fit max-w-full flex-wrap items-center gap-4">
          <Input
            size="large"
            value={draftKeyword}
            placeholder="搜索课程名/讲师"
            prefix={<SearchOutlined className="text-slate-400" />}
            onChange={(event) => setDraftKeyword(event.target.value)}
            onPressEnter={() =>
              updateQuery((prev) => ({
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
              updateQuery((prev) => ({ ...prev, status: value ?? "", page: 1 }))
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
              updateQuery((prev) => ({
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
              updateQuery((prev) => ({
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
            onClick={resetFilters}
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
          scroll={{ x: 800 }}
          className="course-table-like manage-table"
          locale={{ emptyText: "暂无课程数据" }}
        />

        <PaginationBar
          page={data?.page ?? 1}
          pageSize={data?.pageSize ?? 10}
          total={data?.total ?? 0}
          onPageChange={(page) => updateQuery((prev) => ({ ...prev, page }))}
          onPageSizeChange={(pageSize) =>
            updateQuery((prev) => ({ ...prev, pageSize, page: 1 }))
          }
        />
      </Card>

      <Modal
        open={formOpen}
        title={editingId ? "编辑课程" : "新增课程"}
        onCancel={() => !formLoading && setFormOpen(false)}
        onOk={submitForm}
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
