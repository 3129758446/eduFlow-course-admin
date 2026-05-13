/* 
模块：学生管理页面
定位：学生列表/筛选/分页 + 新增/编辑/删除 交互聚合页，支持学号唯一性校验与选课多选
数据流：由 useStudentStore 统一管理；支持数据（班级/课程）并行拉取
用法：表单使用 antd Form 与 Checkbox.Group 渲染课程多选
*/
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
import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { checkStudentNoUnique } from "../api";
import { DEFAULT_STUDENT_FORM, STUDENT_STATUS_TEXT } from "../constants";
import { Permission } from "../components/Permission";
import { Card, PaginationBar } from "../components/ui";
import { PERMISSIONS } from "../permissions";
import { useAuthStore } from "../stores/auth-store";
import { useStudentStore } from "../stores/student-store";
import type { Student, StudentFormValue } from "../types";
import { appErrorMessage, parseMaybeChinese } from "../utils/text";

export function StudentsPage() {
  const [form] = Form.useForm<StudentFormValue>();
  const setGlobalError = useAuthStore((state) => state.setGlobalError);
  const canOperateStudent = useAuthStore((state) =>
    state.hasAnyPermission([
      PERMISSIONS.STUDENTS_UPDATE,
      PERMISSIONS.STUDENTS_DELETE,
    ]),
  );
  const {
    data,
    loading,
    classes,
    courses,
    query,
    draftKeyword,
    formOpen,
    editingId,
    formLoading,
    deletingId,
    setDraftKeyword,
    initializePage,
    updateQuery,
    resetFilters,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    deleteStudentById,
  } = useStudentStore(
    useShallow((state) => ({
      data: state.data,
      loading: state.loading,
      classes: state.classes,
      courses: state.courses,
      query: state.query,
      draftKeyword: state.draftKeyword,
      formOpen: state.formOpen,
      editingId: state.editingId,
      formLoading: state.formLoading,
      deletingId: state.deletingId,
      setDraftKeyword: state.setDraftKeyword,
      initializePage: state.initializePage,
      updateQuery: state.updateQuery,
      resetFilters: state.resetFilters,
      openCreate: state.openCreate,
      openEdit: state.openEdit,
      closeForm: state.closeForm,
      submitForm: state.submitForm,
      deleteStudentById: state.deleteStudentById,
    })),
  );

  const courseNameMap = useMemo(
    () =>
      Object.fromEntries(
        courses.map((course) => [course.id, parseMaybeChinese(course.name)]),
      ) as Record<number, string>,
    [courses],
  );

  useEffect(() => {
    void initializePage();
  }, [initializePage]);

  useEffect(() => {
    setGlobalError("");
  }, [setGlobalError]);

  const handleOpenCreate = () => {
    // 新增时重置成默认表单，避免编辑过的学生信息污染下一次新增。
    form.setFieldsValue(DEFAULT_STUDENT_FORM);
    openCreate();
  };

  const handleOpenEdit = useCallback(async (id: number) => {
    // 编辑场景以详情接口返回为准，避免列表数据字段不全或不是最新值。
    const detail = await openEdit(id);
    if (!detail) {
      return;
    }

    form.setFieldsValue({
      name: detail.name,
      student_no: detail.student_no,
      class_name: detail.class_name,
      phone: detail.phone,
      email: detail.email,
      status: detail.status,
      course_ids: detail.course_ids,
    });
  }, [form, openEdit]);

  const handleSubmitForm = async () => {
    try {
      const formValue = await form.validateFields();
      await submitForm(formValue);
    } catch (error) {
      if (error instanceof Error) {
        const message = appErrorMessage(error);
        // 如果后端返回“学号已存在”，把错误精确回填到学号字段，用户更容易定位问题。
        if (message.includes("学号已存在")) {
          form.setFields([{ name: "student_no", errors: [message] }]);
        }
        setGlobalError(message);
      }
    }
  };

  const columns = useMemo<ColumnsType<Student>>(
    () => [
      // 学生列表把“身份信息、联系方式、课程关系、状态、操作”分成独立列，信息密度更均衡。
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
          // 列表里只保存 course_ids，页面层通过 courseNameMap 映射成人可读课程名。
          const selectedCourses = student.course_ids.length
            ? student.course_ids
                .map((id) => courseNameMap[id] || `课程 ${id}`)
                .join("、")
            : "未选课程";
          return (
            <div
              className="text-base text-slate-700 w-full whitespace-nowrap overflow-hidden text-ellipsis"
              title={selectedCourses}
            >
              {selectedCourses}
            </div>
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
            <Permission code={PERMISSIONS.STUDENTS_UPDATE}>
              <Button
                type="link"
                className="list-action"
                icon={<EditOutlined />}
                onClick={() => {
                  void handleOpenEdit(student.id);
                }}
              >
                编辑
              </Button>
            </Permission>
            <Permission code={PERMISSIONS.STUDENTS_DELETE}>
              <Popconfirm
                title={`确认删除学生“${parseMaybeChinese(student.name)}”吗？`}
                onConfirm={async () => {
                  await deleteStudentById(student.id);
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
            </Permission>
          </Space>
        ),
      },
    ],
    [courseNameMap, deleteStudentById, deletingId, handleOpenEdit],
  );
  const visibleColumns = useMemo(
    () =>
      canOperateStudent
        ? columns
        : columns.filter((column) => column.key !== "actions"),
    [canOperateStudent, columns],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="m-0 text-4xl font-extrabold text-slate-900">学生管理</h2>
        <Permission code={PERMISSIONS.STUDENTS_CREATE}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="manage-action-button bg-sky-200 text-lg font-bold text-slate-900"
          >
            新增学生
          </Button>
        </Permission>
      </div>

      <Card title="" className="manage-card">
        {/* 查询区与课程页保持同构，用户切换模块时不需要重新适应交互。 */}
        <div className="mb-8 flex w-fit max-w-full flex-wrap items-center gap-4">
          <Input
            size="large"
            value={draftKeyword}
            placeholder="搜索姓名/学号"
            prefix={<SearchOutlined className="text-slate-400" />}
            onChange={(event) => setDraftKeyword(event.target.value)}
            onPressEnter={() =>
              // 搜索输入与真正请求参数分离，只有确认搜索时才刷新列表。
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
            value={query.className || undefined}
            placeholder="全部班级"
            allowClear
            className="w-45! rounded-3.5! border-4! border-slate-300!"
            onChange={(value) =>
              void updateQuery((prev) => ({
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
              void updateQuery((prev) => ({
                ...prev,
                status: value ?? "",
                page: 1,
              }))
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
          // 学生表格同样关闭内置分页，统一用外部 PaginationBar 管理页码与 pageSize。
          rowKey="id"
          dataSource={data?.list ?? []}
          columns={visibleColumns}
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
        title={editingId ? "编辑学生" : "新增学生"}
        onCancel={() => !formLoading && closeForm()}
        onOk={handleSubmitForm}
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
          {/* 表单前半部分是基础身份字段，后半部分是联系方式与课程关系字段。 */}
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
                // 先做格式校验，再做异步唯一性校验，避免无效输入也去请求后端。
                { required: true, message: "请输入学号" },
                { pattern: /^\d{8}$/, message: "学号格式应为 8 位数字" },
                {
                  validator: async (_, value?: string) => {
                    const studentNo = value?.trim();
                    if (!studentNo || !/^\d{8}$/.test(studentNo)) return;

                    // 前端失焦时先做一次唯一性预检查，减少提交后才报错的挫败感。
                    const result = await checkStudentNoUnique(
                      studentNo,
                      editingId ?? undefined,
                    );
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
                {
                  pattern: /^1[3-9]\d{9}$/,
                  message: "请输入正确的 11 位手机号",
                },
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
                // 课程是多选关系字段，因此用自定义校验保证至少选择一门课程。
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
