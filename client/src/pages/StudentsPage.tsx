import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
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
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createStudent,
  checkStudentNoUnique,
  deleteStudent,
  fetchClasses,
  fetchCourses,
  fetchStudentDetail,
  fetchStudents,
  updateStudent,
} from "../api";
import { DEFAULT_STUDENT_FORM, STUDENT_STATUS_TEXT } from "../constants";
import { Card, PaginationBar } from "../components/ui";
import type {
  Course,
  Student,
  StudentFormValue,
  StudentListResponse,
  StudentQuery,
} from "../types";
import { pageAfterDelete } from "../utils/pagination";
import { appErrorMessage, parseMaybeChinese } from "../utils/text";

export function StudentsPage({
  setGlobalError,
}: {
  setGlobalError: (value: string) => void;
}) {
  const [data, setData] = useState<StudentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState<StudentQuery>({
    keyword: "",
    className: "",
    status: "",
    page: 1,
    pageSize: 10,
  });
  const [draftKeyword, setDraftKeyword] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form] = Form.useForm<StudentFormValue>();

  const courseNameMap = useMemo(
    () =>
      Object.fromEntries(
        courses.map((course) => [course.id, parseMaybeChinese(course.name)]),
      ) as Record<number, string>,
    [courses],
  );

  const updateQuery = (updater: (prev: StudentQuery) => StudentQuery) => {
    setLoading(true);
    setQuery(updater);
  };

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchStudents(query);
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
    fetchStudents(query)
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
    Promise.all([
      fetchClasses(),
      fetchCourses({
        page: 1,
        pageSize: 100,
        keyword: "",
        status: "",
        category: "",
        sortField: "",
        sortOrder: "",
      }).then((result) => result.list),
    ])
      .then(([classList, courseList]) => {
        setClasses(classList);
        setCourses(courseList);
      })
      .catch((error) => setGlobalError(appErrorMessage(error)));
  }, [setGlobalError]);

  const openCreate = () => {
    setEditingId(null);
    form.setFieldsValue(DEFAULT_STUDENT_FORM);
    setFormOpen(true);
  };

  const openEdit = useCallback(
    async (id: number) => {
      setFormLoading(true);
      setFormOpen(true);
      try {
        const detail = await fetchStudentDetail(id);
        setEditingId(id);
        form.setFieldsValue({
          name: detail.name,
          student_no: detail.student_no,
          class_name: detail.class_name,
          phone: detail.phone,
          email: detail.email,
          status: detail.status,
          course_ids: detail.course_ids,
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
        await updateStudent(editingId, formValue);
      } else {
        await createStudent(formValue);
      }
      setFormOpen(false);
      await refreshList();
    } catch (error) {
      if (error instanceof Error) {
        const message = appErrorMessage(error);
        if (message.includes("学号已存在")) {
          form.setFields([{ name: "student_no", errors: [message] }]);
        }
        setGlobalError(message);
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
      className: "",
      status: "",
      page: 1,
    }));
  };

  const handleDeleteStudent = useCallback(
    async (id: number) => {
      setDeletingId(id);
      try {
        await deleteStudent(id);

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
      } finally {
        setDeletingId(null);
      }
    },
    [data?.total, query.page, query.pageSize, refreshList, setGlobalError],
  );

  const columns = useMemo<ColumnsType<Student>>(
    () => [
      {
        title: "姓名",
        dataIndex: "name",
        key: "name",
        width: "10%",
        render: (value) => (
          <span className="list-title">{parseMaybeChinese(value)}</span>
        ),
      },
      {
        title: "学号",
        dataIndex: "student_no",
        key: "student_no",
        width: "10%",
      },
      {
        title: "班级",
        dataIndex: "class_name",
        key: "class_name",
        width: "10%",
        render: (value) => (
          <Tag className="list-chip list-chip--violet">
            {parseMaybeChinese(value || "未分班")}
          </Tag>
        ),
      },
      {
        title: "联系方式",
        key: "contact",
        width: "15%",
        render: (_, student) => (
          <div className="py-1">
            <div className="list-meta">{student.phone || "-"}</div>
            <div className="list-subtitle mt-1">{student.email || "-"}</div>
          </div>
        ),
      },
      {
        title: "已选课程",
        key: "courses",
        width: "20%",
        ellipsis: true,
        render: (_, student) => {
          const selectedCourses = student.course_ids.length
            ? student.course_ids
                .map((id) => courseNameMap[id] || `课程 ${id}`)
                .join("、")
            : "未选课程";
          return (
            <div 
              className="text-base text-slate-700 w-full whitespace-nowrap overflow-hidden text-ellipsis"
              title={selectedCourses}
            >{selectedCourses}</div>
          );
        },
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: "10%",
        render: (value) => (
          <Tag
            className={`list-status ${
              value === "active" ? "list-status--success" : "list-status--muted"
            }`}
          >
            {STUDENT_STATUS_TEXT[value] || value}
          </Tag>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: "15%",
        render: (_, student) => (
          <Space className="list-actions" size={0} wrap>
            <Button
              type="link"
              className="list-action"
              icon={<EditOutlined />}
              onClick={() => openEdit(student.id)}
            >
              编辑
            </Button>
            <Popconfirm
              title={`确认删除学生“${parseMaybeChinese(student.name)}”吗？`}
              onConfirm={async () => {
                await handleDeleteStudent(student.id);
              }}
              okButtonProps={{ loading: deletingId === student.id }}
              okText="确认"
              cancelText="取消"
            >
              <Button
                danger
                type="link"
                className="list-action list-action--danger"
                icon={<DeleteOutlined />}
                loading={deletingId === student.id}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [courseNameMap, deletingId, handleDeleteStudent, openEdit],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">
          学生管理
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
        >
          新增学生
        </Button>
      </div>

      <Card title="" className="manage-card">
        <div className="mb-8 flex w-fit max-w-full flex-wrap items-center gap-4">
          <Input
            size="large"
            value={draftKeyword}
            placeholder="搜索姓名/学号"
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
            value={query.className || undefined}
            placeholder="全部班级"
            allowClear
            className="w-45! rounded-3.5! border-4! border-slate-300!"
            onChange={(value) =>
              updateQuery((prev) => ({
                ...prev,
                className: value ?? "",
                page: 1,
              }))
            }
            options={classes.map((className) => ({
              value: className,
              label: parseMaybeChinese(className),
            }))}
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
              { value: "active", label: "活跃" },
              { value: "inactive", label: "非活跃" },
            ]}
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
          locale={{ emptyText: "暂无学生数据" }}
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
        title={editingId ? "编辑学生" : "新增学生"}
        onCancel={() => !formLoading && setFormOpen(false)}
        onOk={submitForm}
        confirmLoading={formLoading}
        okText="保存"
        cancelText="取消"
        centered
        destroyOnHidden
        width={820}
        className="manage-modal"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_STUDENT_FORM}
          className="pt-4"
        >
          <div className="grid gap-x-5 md:grid-cols-2">
            <Form.Item
              label="姓名"
              name="name"
              rules={[
                { required: true, message: "请输入姓名" },
                { whitespace: true, message: "姓名不能只包含空格" },
                { max: 20, message: "姓名不能超过 20 个字符" },
              ]}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>

            <Form.Item
              label="学号"
              name="student_no"
              validateTrigger="onBlur"
              rules={[
                { required: true, message: "请输入学号" },
                { pattern: /^\d{8}$/, message: "学号格式应为 8 位数字" },
                {
                  validator: async (_, value?: string) => {
                    const studentNo = value?.trim();
                    if (!studentNo || !/^\d{8}$/.test(studentNo)) return;

                    const result = await checkStudentNoUnique(studentNo, editingId ?? undefined);
                    if (!result.unique) {
                      throw new Error("学号已存在");
                    }
                  },
                },
              ]}
            >
              <Input placeholder="请输入学号" />
            </Form.Item>

            <Form.Item
              label="班级"
              name="class_name"
              rules={[{ required: true, message: "请选择班级" }]}
            >
              <Select
                placeholder="请选择班级"
                options={classes.map((className) => ({
                  value: className,
                  label: parseMaybeChinese(className),
                }))}
                className="w-full rounded-3.5! border-4!"
              />
            </Form.Item>
            <Form.Item
              label="状态"
              name="status"
              rules={[{ required: true, message: "请选择状态" }]}
            >
              <Select
                options={[
                  { value: "active", label: "活跃" },
                  { value: "inactive", label: "非活跃" },
                ]}
                className="w-full rounded-3.5! border-4!"
              />
            </Form.Item>
            <Form.Item
              label="手机号"
              name="phone"
              rules={[
                { required: true, message: "请输入手机号" },
                { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的 11 位手机号" },
              ]}
            >
              <Input placeholder="请输入手机号" />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "请输入正确的邮箱地址" },
              ]}
            >
              <Input placeholder="请输入邮箱" />
            </Form.Item>
            <Form.Item
              label="课程"
              name="course_ids"
              className="md:col-span-2"
              rules={[
                {
                  validator: (_, value?: number[]) =>
                    value?.length
                      ? Promise.resolve()
                      : Promise.reject(new Error("请至少选择一门课程")),
                },
              ]}
            >
              <Checkbox.Group className="manage-checkbox-group grid gap-3 rounded-4.5 border-dashed border-slate-300 p-5 md:grid-cols-3">
                {courses.map((course) => (
                  <label
                    key={course.id}
                    className="flex items-start gap-3 text-base leading-7 text-slate-800"
                  >
                    <Checkbox value={course.id} />
                    <span>{parseMaybeChinese(course.name)}</span>
                  </label>
                ))}
              </Checkbox.Group>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
