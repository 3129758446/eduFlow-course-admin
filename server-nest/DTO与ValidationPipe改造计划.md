# DTO 与 ValidationPipe 改造实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。执行前先重读本计划，执行中不得修改 Docker 配置。

**目标：** 为 `server-nest` 补充 DTO 和全局 `ValidationPipe`，把 Controller 入参类型、请求体校验和查询参数转换规范化，同时保持现有 API 路径、响应结构、状态码和前端错误提示不变。

**架构：** Controller 负责接收 DTO，`ValidationPipe` 负责基础格式校验和类型转换，Service 继续负责业务规则、数据库存在性校验和跨表逻辑。参数 ID 暂时仍保留 `string` 并由现有 service/helper 解析，避免 `ParseIntPipe` 把旧接口的 404 行为改成 400。

**技术栈：** NestJS、TypeScript、class-validator、class-transformer、TypeORM、Jest、Supertest。

---

## 一、改造边界

本阶段只做 DTO 和 ValidationPipe，不做以下事情：

- 不修改 Docker 配置。
- 不改变数据库表结构和 migration。
- 不改变前端接口路径、字段名和响应结构。
- 不新增 mapper/repository 层。
- 不把所有业务校验都挪进 DTO；涉及数据库和权限的校验仍留在 Service。
- 不使用 `forbidNonWhitelisted: true`，避免前端多传字段时突然返回 400。
- 不对 `@Param('id')` 使用 Nest 内置 `ParseIntPipe`，避免非法 ID 从旧的 404 变成默认 400。

成功标准：

- 所有成功响应仍是 `{ code: 0, msg, data }`。
- 所有校验失败仍是 `{ code: 400, msg, data: null }`。
- 认证失败仍是 401，权限失败仍是 403。
- 课程、学员、总结、账号、角色接口的现有契约测试继续通过。
- 新增 DTO 后，Service 不再接收大面积 `Record<string, unknown>`。

---

## 二、计划创建或修改的文件

### 依赖与全局配置

- 修改：`server-nest/package.json`
  - 增加 `class-validator` 和 `class-transformer`。
- 修改：`server-nest/package-lock.json`
  - 由 `npm install class-validator class-transformer` 自动更新。
- 修改：`server-nest/src/main.ts`
  - 注册全局 `ValidationPipe`。
  - 使用自定义 `exceptionFactory` 抛出 `ApiException(400, message)`。

### 公共 DTO 能力

- 创建：`server-nest/src/common/validation.pipe.ts`
  - 导出 `createValidationPipe()`。
  - 统一配置 `transform: true`、`whitelist: true`。
  - 从 `ValidationError` 中提取第一条中文错误信息。
- 创建：`server-nest/src/common/dto/pagination-query.dto.ts`
  - 可选 `page`、`pageSize`。
  - 使用 `@Type(() => Number)` 做显式转换。
  - 限制 `page >= 1`，`pageSize` 在 `1..100` 内。
- 创建：`server-nest/src/common/dto/permission-list.dto.ts`
  - 用于校验 `permissions?: string[]`。
  - 确保传入时必须是字符串数组。

### Auth 模块

- 创建：`server-nest/src/auth/dto/auth.dto.ts`
  - `LoginDto`
  - `ChangePasswordDto`
- 修改：`server-nest/src/auth/auth.controller.ts`
  - `@Body()` 类型替换为 DTO。
- 修改：`server-nest/src/auth/auth.service.ts`
  - 方法入参从内联类型替换为 DTO。
  - 保留密码比对、用户存在性等业务校验。

### Courses 模块

- 创建：`server-nest/src/courses/dto/course.dto.ts`
  - `CourseListQueryDto`
  - `CreateCourseDto`
  - `UpdateCourseDto`
- 修改：`server-nest/src/courses/courses.controller.ts`
  - `@Query()` / `@Body()` 替换为 DTO。
- 修改：`server-nest/src/courses/courses.service.ts`
  - 入参类型替换为 DTO。
  - 删除已由 DTO 覆盖的基础空值校验。
  - 保留排序白名单和数据库查询逻辑。

### Students 模块

- 创建：`server-nest/src/students/dto/student.dto.ts`
  - `StudentListQueryDto`
  - `CheckStudentNoQueryDto`
  - `CreateStudentDto`
  - `UpdateStudentDto`
- 修改：`server-nest/src/students/students.controller.ts`
  - `@Query()` / `@Body()` 替换为 DTO。
- 修改：`server-nest/src/students/students.service.ts`
  - 入参类型替换为 DTO。
  - 保留学号重复、课程 ID 是否存在、课程人数重算等业务逻辑。
  - `normalizeStudentPayload()` 可缩减为业务归一化函数，避免重复基础校验。

### Summary 模块

- 创建：`server-nest/src/summary/dto/summary.dto.ts`
  - `SummaryListQueryDto`
  - `CreateSummaryDto`
  - `UpdateSummaryDto`
- 修改：`server-nest/src/summary/summary.controller.ts`
  - `@Query()` / `@Body()` 替换为 DTO。
- 修改：`server-nest/src/summary/summary.service.ts`
  - 入参类型替换为 DTO。
  - 保留当前用户隔离查询和 404 语义。

### System 模块

- 创建：`server-nest/src/system/dto/system.dto.ts`
  - `UpdateUserRoleDto`
  - `CreateUserDto`
  - `CreateRoleDto`
  - `UpdateRoleInfoDto`
  - `UpdateRolePermissionsDto`
- 修改：`server-nest/src/system/system.controller.ts`
  - `@Body()` 替换为 DTO。
- 修改：`server-nest/src/system/system.service.ts`
  - 入参类型替换为 DTO。
  - 保留 admin 保护、角色可分配性、用户名唯一性等业务规则。

### 测试与文档

- 修改：`server-nest/test/api-contract.e2e-spec.ts`
  - 增加 DTO/ValidationPipe 错误格式测试。
  - 覆盖未知字段被忽略、类型错误返回旧格式。
- 修改：`server-nest/NestJS 后端技术文档.md`
  - 增加 DTO 和 ValidationPipe 章节。
- 修改：`项目技术文档.md`
  - 同步后端入参校验方式。
- 修改：`面试问答手册.md`
  - 增加“为什么补 DTO + ValidationPipe”的回答口径。
- 修改：`CLAUDE.md`
  - 增加后续开发约定：新增接口必须先写 DTO。

---

## 三、ValidationPipe 设计

全局 Pipe 应统一放在 `main.ts` 中：

```ts
app.useGlobalPipes(createValidationPipe());
```

`createValidationPipe()` 的目标配置：

```ts
new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
  exceptionFactory: (errors) => new ApiException(400, getFirstValidationMessage(errors)),
});
```

设计理由：

- `transform: true`：把 query string 显式转换成 DTO 中声明的 number。
- `whitelist: true`：自动移除 DTO 未声明字段，降低脏字段进入 Service 的概率。
- `forbidNonWhitelisted: false`：多传字段时静默剔除，避免破坏前端旧请求。
- `exceptionFactory`：保证错误响应仍走 `ApiExceptionFilter`，格式是 `{ code, msg, data }`。

错误消息提取规则：

1. 优先读取第一个 `ValidationError.constraints` 的第一条消息。
2. 如果当前字段没有 constraints，递归读取 children。
3. 如果没有任何可读消息，返回 `请求参数不合法`。

---

## 四、DTO 设计细节

### 1. 登录 DTO

`LoginDto`：

```ts
class LoginDto {
  @IsString({ message: '请输入用户名和密码' })
  @IsNotEmpty({ message: '请输入用户名和密码' })
  username: string;

  @IsString({ message: '请输入用户名和密码' })
  @IsNotEmpty({ message: '请输入用户名和密码' })
  password: string;
}
```

注意：用户名不存在或密码错误仍由 `AuthService` 返回 `用户名或密码错误`，避免暴露用户是否存在。

### 2. 课程 DTO

`CreateCourseDto`：

- `name` 必填字符串，错误消息：`课程名称不能为空`。
- `description`、`instructor`、`category` 可选字符串。
- `status` 可选，允许 `draft`、`published`。
- `lesson_count` 可选数字，最小值 0。

`UpdateCourseDto`：

- 所有字段可选。
- 如果传入 `name`，不能为空字符串。
- `status` 同样限制为 `draft`、`published`。

`CourseListQueryDto`：

- 继承分页字段。
- `keyword`、`status`、`category`、`sortField`、`sortOrder` 可选。
- `sortOrder` 允许 `ascend`、`descend`。

### 3. 学员 DTO

`CreateStudentDto`：

- `name` 必填，错误消息：`学生姓名和学号不能为空`。
- `student_no` 必填，格式 `^\d{8}$`，错误消息：`学号格式应为 8 位数字`。
- `phone` 必填，格式 `^1[3-9]\d{9}$`，错误消息：`手机号格式不正确`。
- `email` 必填，邮箱格式错误消息：`邮箱格式不正确`。
- `status` 可选，允许 `active`、`inactive`。
- `course_ids` 必填数组，元素为正整数，空数组错误消息：`请至少选择一门课程`。

`UpdateStudentDto`：

- 为了保持旧接口局部更新能力，字段整体可选。
- 但如果传了 `course_ids`，必须是正整数数组，且不能为空。
- 学号、手机号、邮箱传入时必须符合格式。

`CheckStudentNoQueryDto`：

- `student_no` 必填，错误消息：`学号不能为空`。
- `excludeId` 可选字符串，Service 里继续兼容数字字符串。

### 4. 学习总结 DTO

`CreateSummaryDto`：

- `title` 必填非空，错误消息：`标题不能为空`。
- `content` 必填非空，错误消息：`内容不能为空`。

`UpdateSummaryDto`：

- `title`、`content` 可选。
- 如果传入，不能为空。
- Service 仍负责合并已有数据后保存。

### 5. 系统管理 DTO

`CreateUserDto`：

- `username` 必填非空。
- `name` 必填非空。
- `role` 必填非空。
- 错误消息统一为：`用户名、姓名和角色不能为空`。

`UpdateUserRoleDto`：

- `role` 必填非空，错误消息：`角色不能为空`。

`CreateRoleDto`：

- `name` 必填非空。
- `description` 可选字符串。
- `permissions` 可选字符串数组。

`UpdateRoleInfoDto`：

- `name` 可选字符串。
- `description` 可选字符串。
- 如果传入 `name`，不能为空。

`UpdateRolePermissionsDto`：

- `permissions` 必填字符串数组。

---

## 五、任务分解

### 任务 1：安装 DTO 校验依赖

**文件：**

- 修改：`server-nest/package.json`
- 修改：`server-nest/package-lock.json`

- [ ] 步骤 1：运行依赖安装

```bash
cd server-nest
npm install class-validator class-transformer
```

- [ ] 步骤 2：确认依赖写入

运行：

```bash
rg -n "\"class-validator\"|\"class-transformer\"" server-nest/package.json server-nest/package-lock.json
```

预期：两个依赖都能在 `dependencies` 中找到。

### 任务 2：为全局 ValidationPipe 写失败测试

**文件：**

- 修改：`server-nest/test/api-contract.e2e-spec.ts`

- [ ] 步骤 1：增加课程创建参数错误测试

在契约测试中新增用例：

```ts
it('keeps DTO validation errors in the legacy envelope shape', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ description: 'missing name' })
    .expect(400);

  expect(response.body).toEqual({
    code: 400,
    msg: '课程名称不能为空',
    data: null,
  });
});
```

- [ ] 步骤 2：运行测试确认失败

运行：

```bash
cd server-nest
npm test -- --verbose test/api-contract.e2e-spec.ts
```

预期：新增测试失败。失败原因应是当前 Service 或 Pipe 尚未按 DTO 路径处理，而不是测试文件语法错误。

### 任务 3：实现公共 ValidationPipe

**文件：**

- 创建：`server-nest/src/common/validation.pipe.ts`
- 修改：`server-nest/src/main.ts`

- [ ] 步骤 1：创建 `validation.pipe.ts`

实现 `createValidationPipe()`、`getFirstValidationMessage()`。

- [ ] 步骤 2：在 `main.ts` 注册全局 Pipe

在 `app.useGlobalFilters(new ApiExceptionFilter())` 附近增加：

```ts
app.useGlobalPipes(createValidationPipe());
```

- [ ] 步骤 3：运行构建

```bash
cd server-nest
npm run build
```

预期：TypeScript 编译通过。

### 任务 4：补 Auth DTO

**文件：**

- 创建：`server-nest/src/auth/dto/auth.dto.ts`
- 修改：`server-nest/src/auth/auth.controller.ts`
- 修改：`server-nest/src/auth/auth.service.ts`

- [ ] 步骤 1：创建 `LoginDto` 和 `ChangePasswordDto`

字段和错误消息按“四、DTO 设计细节”实现。

- [ ] 步骤 2：Controller 使用 DTO

`login(@Body() body: LoginDto)`，`password(@Body() body: ChangePasswordDto)`。

- [ ] 步骤 3：Service 入参替换为 DTO

保留用户不存在、密码错误、新密码长度等业务校验。

- [ ] 步骤 4：运行认证相关测试

```bash
cd server-nest
npm test -- --verbose test/api-contract.e2e-spec.ts
```

预期：登录成功、登录失败、`/auth/me` 测试通过。

### 任务 5：补 Courses DTO

**文件：**

- 创建：`server-nest/src/courses/dto/course.dto.ts`
- 修改：`server-nest/src/courses/courses.controller.ts`
- 修改：`server-nest/src/courses/courses.service.ts`

- [ ] 步骤 1：创建课程 DTO

实现 `CourseListQueryDto`、`CreateCourseDto`、`UpdateCourseDto`。

- [ ] 步骤 2：Controller 替换入参类型

`list(@Query() query: CourseListQueryDto)`，`create(@Body() body: CreateCourseDto)`，`update(@Body() body: UpdateCourseDto)`。

- [ ] 步骤 3：Service 替换入参类型

删除 `create()` 中 `if (!name) fail(400, '课程名称不能为空')`，因为 DTO 已负责基础校验。

- [ ] 步骤 4：运行课程契约测试

```bash
cd server-nest
npm test -- --verbose test/api-contract.e2e-spec.ts
```

预期：课程列表、创建、更新、上下架、删除和新增 DTO 错误测试通过。

### 任务 6：补 Students DTO

**文件：**

- 创建：`server-nest/src/students/dto/student.dto.ts`
- 修改：`server-nest/src/students/students.controller.ts`
- 修改：`server-nest/src/students/students.service.ts`

- [ ] 步骤 1：创建学员 DTO

实现 `StudentListQueryDto`、`CheckStudentNoQueryDto`、`CreateStudentDto`、`UpdateStudentDto`。

- [ ] 步骤 2：新增学员错误格式测试

覆盖手机号、邮箱、状态、空课程数组仍返回旧错误消息。

- [ ] 步骤 3：Controller 替换入参类型

`checkNo(@Query() query: CheckStudentNoQueryDto)` 后传给 Service。

- [ ] 步骤 4：Service 缩减 `normalizeStudentPayload()`

Service 保留学号重复、课程存在性、课程人数重算；基础字段格式交给 DTO。

- [ ] 步骤 5：运行学员契约测试

```bash
cd server-nest
npm test -- --verbose test/api-contract.e2e-spec.ts
```

预期：学员所有校验、详情展开和课程人数重算测试通过。

### 任务 7：补 Summary DTO

**文件：**

- 创建：`server-nest/src/summary/dto/summary.dto.ts`
- 修改：`server-nest/src/summary/summary.controller.ts`
- 修改：`server-nest/src/summary/summary.service.ts`

- [ ] 步骤 1：创建总结 DTO

实现 `SummaryListQueryDto`、`CreateSummaryDto`、`UpdateSummaryDto`。

- [ ] 步骤 2：Controller 和 Service 替换入参类型

保留按 `user_id` 隔离的查询条件。

- [ ] 步骤 3：运行总结契约测试

```bash
cd server-nest
npm test -- --verbose test/api-contract.e2e-spec.ts
```

预期：空内容 400、创建、详情、列表脱敏和用户隔离测试通过。

### 任务 8：补 System DTO

**文件：**

- 创建：`server-nest/src/system/dto/system.dto.ts`
- 修改：`server-nest/src/system/system.controller.ts`
- 修改：`server-nest/src/system/system.service.ts`

- [ ] 步骤 1：创建系统管理 DTO

实现用户、角色、权限更新相关 DTO。

- [ ] 步骤 2：Controller 替换 `@Body()` 内联类型

角色高风险操作仍在 Controller 校验 `req.user.role === 'admin'`。

- [ ] 步骤 3：Service 替换入参类型

保留角色可分配性、用户名唯一性、admin 不可变等业务规则。

- [ ] 步骤 4：运行系统管理契约测试

```bash
cd server-nest
npm test -- --verbose test/api-contract.e2e-spec.ts
```

预期：账号列表、自定义角色、admin-only 保护、角色权限变更即时生效测试通过。

### 任务 9：补全 DTO 覆盖测试

**文件：**

- 修改：`server-nest/test/api-contract.e2e-spec.ts`

- [ ] 步骤 1：增加未知字段剔除测试

示例：创建课程时传入 `unexpected_field`，响应中不应出现该字段，数据库保存结果也不应包含该字段。

- [ ] 步骤 2：增加 query 类型转换测试

示例：`GET /api/courses?page=1&pageSize=5` 返回 `page: 1`、`pageSize: 5`，类型为 number。

- [ ] 步骤 3：运行完整测试

```bash
cd server-nest
npm test -- --verbose
```

预期：全部测试通过。

### 任务 10：同步文档

**文件：**

- 修改：`server-nest/NestJS 后端技术文档.md`
- 修改：`项目技术文档.md`
- 修改：`面试问答手册.md`
- 修改：`CLAUDE.md`

- [ ] 步骤 1：增加 DTO 章节

说明 Controller 接 DTO，ValidationPipe 做基础校验，Service 做业务校验。

- [ ] 步骤 2：更新面试口径

说明为什么先迁移 TypeORM，再补 DTO：降低一次性迁移风险，同时逐步靠近 NestJS 最佳实践。

- [ ] 步骤 3：更新开发约定

新增接口必须先定义 DTO；新增校验必须补契约测试。

### 任务 11：最终验证

**文件：**

- 检查：全仓库

- [ ] 步骤 1：确认无旧入参类型残留

```bash
rg -n "@Body\\(\\).*Record<string, unknown>|@Query\\(\\).*Record<string, string>|@Body\\(\\).*\\{.*\\?:" server-nest/src
```

预期：业务 Controller 中不再出现大面积 `Record` 或内联 body 类型。`MIME_TYPES`、`IMAGE_TYPES` 这类常量 Record 不属于问题。

- [ ] 步骤 2：确认构建通过

```bash
cd server-nest
npm run build
```

预期：exit 0。

- [ ] 步骤 3：确认测试通过

```bash
cd server-nest
npm test -- --verbose
```

预期：所有测试通过。

- [ ] 步骤 4：确认格式无问题

```bash
git diff --check
```

预期：exit 0。

- [ ] 步骤 5：确认 Docker 配置未修改

```bash
git diff --name-only | rg -i "(^|/)(docker|docker-compose|compose)|dockerfile"
```

预期：无输出。

---

## 六、可能出现的错误与解决办法

### 1. 安装后 TypeScript 找不到装饰器类型

现象：

```text
Cannot find module 'class-validator'
Cannot find module 'class-transformer'
```

解决：

```bash
cd server-nest
npm install class-validator class-transformer
```

确认依赖在 `dependencies`，不要放到 `devDependencies`，因为生产运行也需要 DTO 校验。

### 2. ValidationPipe 返回 Nest 默认错误结构

现象：

```json
{
  "message": ["课程名称不能为空"],
  "error": "Bad Request",
  "statusCode": 400
}
```

解决：检查 `createValidationPipe()` 是否配置 `exceptionFactory`，并且抛出 `new ApiException(400, message)`。

### 3. query 参数没有转换成 number

现象：`page`、`pageSize` 仍是字符串，分页计算异常。

解决：在 DTO 字段上使用：

```ts
@Type(() => Number)
@IsInt({ message: '分页参数不合法' })
```

不要只依赖全局 `enableImplicitConversion`。

### 4. 空字符串没有被识别为空

现象：`name: '   '` 通过了 `@IsNotEmpty()`。

解决：增加 `@Transform(({ value }) => String(value ?? '').trim())`，先 trim 再校验。

### 5. `course_ids` 数组元素没有转换

现象：前端传 `["1"]` 或 `[1]` 行为不一致。

解决：如果继续要求前端传数字数组，则 DTO 使用 `@IsInt({ each: true })`；如果需要兼容字符串数组，则在 DTO 用 `@Transform()` 显式转换后校验。为了保持当前接口契约，优先接受数字数组。

### 6. 未知字段导致前端请求失败

现象：前端多传 UI 临时字段后接口返回 400。

解决：确认 `forbidNonWhitelisted` 为 `false`。未知字段应被剔除，而不是拒绝请求。

### 7. 非法路由 ID 状态码变化

现象：`GET /api/courses/not-a-number` 从 404 变成 400。

解决：本阶段不要给路由 ID 使用 `ParseIntPipe`。继续让 Service 中的 `parsePositiveIntId()` 返回旧接口约定的 404。

### 8. Service 业务错误被 DTO 错误覆盖

现象：用户名重复、角色不可分配、课程不存在等错误消息变化。

解决：DTO 只做字段形态校验；需要查数据库的规则继续留在 Service。

### 9. 部分测试直接调用 Service 失败

现象：Service 测试传 `Record`，改 DTO 后类型不兼容。

解决：测试对象按 DTO 字段构造；不要为了测试重新放宽 Service 入参类型。

---

## 七、执行顺序建议

推荐按以下顺序执行：

1. 依赖和全局 `ValidationPipe`。
2. Auth DTO。
3. Courses DTO。
4. Students DTO。
5. Summary DTO。
6. System DTO。
7. 契约测试补全。
8. 文档同步。
9. 完整验证。

这样每一步都能运行局部测试，出现错误时容易定位，不会一次性把所有 Controller 和 Service 都改乱。

---

## 八、自检清单

- [ ] 计划覆盖所有有 `@Body()` 的 Controller。
- [ ] 计划覆盖所有业务 `@Query()` 入参。
- [ ] 计划明确保留路由 ID 旧 404 行为。
- [ ] 计划明确错误响应仍为 `{ code, msg, data }`。
- [ ] 计划明确 `class-validator` 和 `class-transformer` 放在 `dependencies`。
- [ ] 计划明确不修改 Docker 配置。
- [ ] 计划包含构建、测试、diff check 和 Docker diff 扫描。

---

## 九、实际执行结果

本阶段已按计划完成 DTO 与全局 `ValidationPipe` 改造。

已落地内容：

- 已在 `dependencies` 中新增 `class-validator` 和 `class-transformer`。
- 已创建 `src/common/validation.pipe.ts`，统一开启 `transform`、`whitelist`，并通过 `ApiException` 保持旧接口错误格式。
- 已创建公共 DTO 工具：分页查询 DTO、权限数组 DTO、字符串 trim 转换器。
- 已为 Auth、Courses、Students、Summary、System 模块补充 DTO。
- Controller 已改为接收 DTO，不再使用大面积 `Record<string, unknown>` 或临时内联 body 类型。
- Service 保留数据库和业务规则校验，例如学号重复、课程是否存在、角色是否可分配、学习总结用户隔离。
- 路由 `id` 未改用 `ParseIntPipe`，继续由 `parsePositiveIntId()` 保持非法 ID 的 404 行为。
- 契约测试已覆盖 DTO 错误 envelope 和未知字段剥离。
- 文档已同步更新：`项目技术文档.md`、`面试问答手册.md`、`CLAUDE.md`、`server-nest/NestJS 后端技术文档.md`。
- Docker 配置未修改。

执行中遇到的问题：

- 普通 `npm install class-validator class-transformer` 因 `typeorm@0.3.20` 与 `better-sqlite3@13` 的可选 peer 依赖范围冲突失败。
- 处理方式：使用 `npm install class-validator class-transformer --legacy-peer-deps` 只追加 DTO 校验依赖，不调整现有数据库测试依赖版本。

最终验证命令：

```bash
cd server-nest
npm run build
npm test -- --verbose
git diff --check
git diff --name-only | rg -i "(^|/)(docker|docker-compose|compose)|dockerfile"
```

验收结论：

- 构建通过。
- 全量测试通过。
- diff 空白检查通过。
- Docker diff 扫描无命中。
