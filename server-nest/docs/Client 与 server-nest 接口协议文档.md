# Client 与 server-nest 接口协议文档

本文档记录 `client/src/api.ts` 与 `server-nest` REST API 的当前契约。前端只通过 `client/src/api.ts` 访问接口；后端以 `server-nest/src/*/*.controller.ts`、DTO 和统一响应封装为准。

## 1. 通用协议

- 前端 Axios `baseURL`：`/api`
- 本地开发代理：`client/vite.config.ts` 将 `/api` 转发到 `http://localhost:3000`
- 后端 Controller 已包含 `api` 前缀，例如 `@Controller('api/courses')`
- 除登录、静态资源读取外，核心业务接口需要 `Authorization: Bearer <token>`

所有 JSON 接口返回统一信封：

```json
{
  "code": 0,
  "msg": "success",
  "data": {}
}
```

失败时：

```json
{
  "code": 400,
  "msg": "错误描述",
  "data": null
}
```

前端 `request<T>()` 会自动解包 `data`，页面和 store 默认拿到业务数据本体。

## 2. Auth

| 前端方法 | 方法与路径 | 权限 | 请求 | 返回 |
| --- | --- | --- | --- | --- |
| `login` | `POST /api/auth/login` | 无 | `{ username, password }` | `{ token, user }` |
| `getCurrentUser` | `GET /api/auth/me` | 登录 | 无 | `User` |
| `changePassword` | `PATCH /api/auth/password` | 登录 | `{ oldPassword, newPassword }` | `null` |

## 3. Dashboard

| 前端方法 | 方法与路径 | 权限 | 请求 | 返回 |
| --- | --- | --- | --- | --- |
| `fetchDashboard` | `GET /api/dashboard` | `dashboard:view` | 无 | `DashboardData` |

`DashboardData.charts.categoryDist` 直接来自 `course_categories.course_count`，不再按课程表临时聚合分类名称。

## 4. Courses

`Course` 主要字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `number` | 课程 ID |
| `name` | `string` | 课程名称 |
| `description` | `string` | 课程描述 |
| `instructor` | `string` | 讲师 |
| `cover` | `string` | 封面 |
| `category` | `string` | 分类名称快照，用于分类被删除后的兜底展示 |
| `category_id` | `string \| null` | 分类外键，指向 `course_categories.id` |
| `status` | `draft \| published` | 草稿或已发布 |
| `student_count` | `number` | 选课人数冗余统计 |
| `lesson_count` | `number` | 课时数 |
| `created_at` / `updated_at` | `string` | 时间字符串 |

| 前端方法 | 方法与路径 | 权限 | 请求 | 返回 |
| --- | --- | --- | --- | --- |
| `fetchCourses` | `GET /api/courses` | `courses:view` | `keyword,status,categoryId,page,pageSize,sortField,sortOrder` | `{ list,total,page,pageSize }` |
| `fetchCourseDetail` | `GET /api/courses/:id` | `courses:view` | 路径 ID | `Course` |
| `createCourse` | `POST /api/courses` | `courses:create` | `CourseFormValue` | `Course` |
| `updateCourse` | `PUT /api/courses/:id` | `courses:update` | `Partial<CourseFormValue>` | `Course` |
| `deleteCourse` | `DELETE /api/courses/:id` | `courses:delete` | 路径 ID | `null` |
| `toggleCourseStatus` | `PATCH /api/courses/:id/status` | `courses:update` | 路径 ID | `Course` |
| `fetchCourseCategories` | `GET /api/course-categories` | `courses:view` | `keyword?` | `CourseCategory[]` |

旧接口 `GET /api/courses/categories` 仍保留为兼容入口，但前端当前使用 `GET /api/course-categories` 作为课程筛选和课程表单下拉数据源。

分类写入约定：

- 新增或编辑课程时，前端发送 `category_id`，后端校验分类是否存在。
- 后端保存课程时同时保存 `category_id` 和 `category` 名称快照。
- 修改分类名称时，后端同步更新已关联课程的 `category` 快照。
- 删除分类时外键使用 `ON DELETE SET NULL`，但业务层不允许删除已有课程的分类。
- 前端不会把非法 `category_id` 静默转成 `null`，避免一次异常保存误清空外键。

## 5. Course Categories

`CourseCategory` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | UUID 字符串主键 |
| `name` | `string` | 分类名称，唯一 |
| `course_count` | `number` | 当前分类下课程数量，写操作时维护 |

| 前端方法 | 方法与路径 | 权限 | 请求 | 返回 |
| --- | --- | --- | --- | --- |
| `fetchCourseCategories` | `GET /api/course-categories` | `courses:view` | `keyword?` 模糊查询分类名 | `CourseCategory[]` |
| `createCourseCategory` | `POST /api/course-categories` | `courses:update` | `{ name }` | `CourseCategory` |
| `updateCourseCategory` | `PUT /api/course-categories/:id` | `courses:update` | `{ name }` | `CourseCategory` |
| `deleteCourseCategory` | `DELETE /api/course-categories/:id` | `courses:update` | 路径 UUID | `null` |

删除分类前，后端会按 `courses.category_id` 重新计算真实课程数量；如果数量大于 0，返回 `400` 和 `该分类下已有课程，不能删除`。

## 6. Students

| 前端方法 | 方法与路径 | 权限 | 请求 | 返回 |
| --- | --- | --- | --- | --- |
| `fetchStudents` | `GET /api/students` | `students:view` | `keyword,className,status,page,pageSize` | `{ list,total,page,pageSize }` |
| `fetchClasses` | `GET /api/students/classes` | `students:view` | 无 | `string[]` |
| `checkStudentNoUnique` | `GET /api/students/check-no` | `students:update` | `student_no,exclude_id?` | `{ unique }` |
| `fetchStudentDetail` | `GET /api/students/:id` | `students:view` | 路径 ID | `StudentDetail` |
| `createStudent` | `POST /api/students` | `students:create` | `StudentFormValue` | `StudentDetail` |
| `updateStudent` | `PUT /api/students/:id` | `students:update` | `StudentFormValue` | `StudentDetail` |
| `deleteStudent` | `DELETE /api/students/:id` | `students:delete` | 路径 ID | `null` |

`StudentFormValue.course_ids` 是课程 ID 数组，后端存入 `students.course_ids` JSON 字符串，并同步维护 `courses.student_count`。

## 7. Summary 与 Upload

| 前端方法 | 方法与路径 | 权限 | 请求 | 返回 |
| --- | --- | --- | --- | --- |
| `fetchSummaries` | `GET /api/summary` | `summary:view` | `keyword,page,pageSize` | `{ list,total,page,pageSize }` |
| `fetchSummaryDetail` | `GET /api/summary/:id` | `summary:view` | 路径 ID | `Summary` |
| `createSummary` | `POST /api/summary` | `summary:create` | `SummaryFormValue` | `Summary` |
| `updateSummary` | `PUT /api/summary/:id` | `summary:update` | `SummaryFormValue` | `Summary` |
| `deleteSummary` | `DELETE /api/summary/:id` | `summary:delete` | 路径 ID | `null` |
| `uploadSummaryImage` | `POST /api/upload/summary-image` | `summary:create` | `multipart/form-data`，字段 `image` | `{ url, filename }` |

总结数据按当前登录用户隔离。上传图片返回的 URL 使用 `/api/static/uploads/summary/...`，由静态资源模块读取。

## 8. System

| 前端方法 | 方法与路径 | 权限 | 请求 | 返回 |
| --- | --- | --- | --- | --- |
| `fetchAccounts` | `GET /api/system/users` | `accounts:view` | 无 | `AccountUser[]` |
| `createAccount` | `POST /api/system/users` | `accounts:updateRole` | `{ username, name, role }` | `AccountUser` |
| `updateAccountRole` | `PATCH /api/system/users/:id/role` | `accounts:updateRole` | `{ role }` | `AccountUser` |
| `deleteAccount` | `DELETE /api/system/users/:id` | `accounts:updateRole` | 路径 ID | `null` |
| `fetchRoles` | `GET /api/system/roles` | `accounts:view` | 无 | `Role[]` |
| `createRole` | `POST /api/system/roles` | `accounts:updateRole` + admin | `{ code,name,description }` | `Role` |
| `updateRoleInfo` | `PATCH /api/system/roles/:code` | `accounts:updateRole` + admin | `{ name,description }` | `Role` |
| `deleteRole` | `DELETE /api/system/roles/:code` | `accounts:updateRole` + admin | 角色 code | `null` |
| `fetchPermissionGroups` | `GET /api/system/permissions` | `accounts:view` | 无 | `PermissionGroup[]` |
| `updateRolePermissions` | `PATCH /api/system/roles/:code/permissions` | `accounts:updateRole` + admin | `{ permissions }` | `Role` |

`+ admin` 表示除了权限码外，还要求当前登录用户真实角色是 `admin`。

## 9. 维护约定

- 新增前端接口必须先放入 `client/src/api.ts`，不要在页面中直接拼 Axios。
- 新增后端接口必须定义 DTO，并保持统一响应信封。
- 改动接口字段时，同步更新 `client/src/types.ts`、本协议文档和 `server-nest/test/api-contract.e2e-spec.ts`。
- 涉及数据库结构时新增 TypeORM migration，不使用 `synchronize` 推结构。
- 课程分类相关改动需要同时考虑 `courses.category_id`、`courses.category` 快照和 `course_categories.course_count` 三者一致性。
