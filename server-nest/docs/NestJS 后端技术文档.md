# NestJS 后端技术文档

本文档用于学习当前 `server-nest` 后端项目。它不是泛泛介绍 NestJS，而是结合本项目从 Koa 后端迁移到 NestJS + TypeORM + MySQL 后的真实代码结构，说明项目怎么启动、请求怎么流转、权限怎么生效、数据库怎么访问，以及如何判断迁移是否成功。

## 一、项目定位

`server-nest` 是 EduFlow 课程后台的默认 NestJS 后端。迁移目标不是重新设计业务，而是在前端和接口契约不变的前提下，把旧 Koa 服务替换为更标准的 NestJS 分层结构，并将数据库从 SQLite 迁移到 MySQL 8.0，同时把业务数据访问从集中手写 SQL 演进为 TypeORM Entity、Repository、QueryBuilder 和 migration。

本次迁移保持以下内容不变：

- API 路径不变，例如 `/api/auth/login`、`/api/courses`、`/api/students`、`/api/summary`、`/api/system/*`。
- 请求参数不变，前端原来的 Axios 调用方式不需要调整。
- 响应结构不变，成功响应仍是 `{ code, msg, data }`。
- 受保护接口仍通过 `Authorization: Bearer <accessToken>` 鉴权；登录态改为短期 Access Token 与 HttpOnly Cookie 中 Refresh Token 配合维护。
- RBAC 权限逻辑不变，仍通过权限码控制菜单、路由、按钮和接口。
- 数据库业务含义不变，表结构由 TypeORM migration 管理。

## 二、技术栈

后端主要技术栈如下：

| 技术 | 项目中的作用 |
| --- | --- |
| NestJS | 后端应用框架，负责模块化、依赖注入、Controller、Service、Guard、Filter 等能力 |
| TypeScript | 后端主开发语言，提供类型约束 |
| TypeORM | ORM 数据层，提供 Entity、Repository、QueryBuilder、migration 和事务能力 |
| mysql2 | TypeORM 连接 MySQL 的底层驱动，启动前建库逻辑也会使用它 |
| MySQL 8.0 | 业务数据持久化数据库 |
| jsonwebtoken | 签发和校验 JWT |
| bcryptjs | 密码加密和密码校验 |
| Jest + Supertest | 接口与会话测试，验证接口契约、令牌刷新和会话失效行为 |
| Docker | 提供容器化部署文件 |

业务代码默认通过 TypeORM 访问数据库，不再使用旧版集中式 `DatabaseService`。`mysql2` 仍然是必要依赖，但只作为 TypeORM 驱动和启动前确保数据库存在的基础设施能力。

## 三、目录结构

核心目录如下：

```text
server-nest
├─ src
│  ├─ main.ts                     # 应用启动入口
│  ├─ app.module.ts               # 根模块
│  ├─ common                      # 统一响应和异常处理
│  ├─ config                      # 环境变量加载
│  ├─ database                    # TypeORM 配置、实体、migration、初始化和日期工具
│  ├─ auth                        # 双 Token 登录、会话管理、JWT 鉴权、接口权限守卫
│  ├─ permissions                 # 权限码、角色权限映射、RBAC 计算
│  ├─ dashboard                   # 工作台统计
│  ├─ course-categories           # 课程分类字典管理
│  ├─ courses                     # 课程管理
│  ├─ students                    # 学员管理
│  ├─ summary                     # 学习总结/笔记
│  ├─ system                      # 用户、角色、权限配置
│  ├─ upload                      # 学习总结图片上传
│  └─ static                      # 上传图片静态访问
├─ scripts
│  ├─ load-env.mjs                # 脚本侧环境变量加载
│  ├─ migrate-sqlite-to-mysql.mjs # SQLite 到 MySQL 的一次性数据迁移脚本
│  └─ verify-db.mjs               # MySQL 数据校验脚本
├─ test
│  ├─ api-contract.e2e-spec.ts    # 接口契约测试
│  ├─ database-init.e2e-spec.ts   # 默认初始化和近 7 天活跃度测试
│  ├─ migration.e2e-spec.ts       # migration 兼容性测试
│  ├─ typeorm-config.e2e-spec.ts  # TypeORM 配置测试
│  └─ date-util.e2e-spec.ts       # 日期格式化工具测试
├─ .env.example                   # 本地 .env 配置模板
├─ Dockerfile
└─ docker-compose.nest.yml
```

学习时建议先看这几类文件：

- 启动流程：`src/main.ts`、`src/app.module.ts`。
- 数据库流程：`src/database/typeorm.config.ts`、`src/database/entities/`、`src/database/migrations/`、`src/database/database.init.ts`。
- 登录鉴权：`src/auth/auth.service.ts`、`src/auth/auth.guard.ts`。
- 权限控制：`src/auth/permissions.guard.ts`、`src/permissions/permission.service.ts`、`src/permissions/permissions.constants.ts`。
- 业务模块：任选一个 Controller + Service，例如 `courses`、`course-categories` 或 `students`。
- 迁移验证：`test/api-contract.e2e-spec.ts`。
- 前后端协议：`docs/Client 与 server-nest 接口协议文档.md`。

## 四、启动流程

项目启动入口是 `src/main.ts`。

启动时主要做这些事：

1. 通过 `NestFactory.create(AppModule)` 创建 NestJS 应用。
2. 调用 `app.enableCors({ credentials: true })` 保留前端本地调试时的跨域凭证兼容。
3. 注册 `ApiExceptionFilter`，把 NestJS 异常统一转换成旧 Koa 接口约定的响应结构。
4. 通过 `TypeOrmModule.forRootAsync()` 读取 MySQL 配置、确保数据库存在并初始化 TypeORM 连接。
5. 按配置执行 TypeORM migration，开发环境默认执行，生产环境需要显式开启。
6. 启动 `DatabaseInit`，只补齐系统默认角色、权限、角色权限映射和默认账号。
7. 启动 `RecentLearningActivityService`，按当前逻辑每日补齐近 7 天学习活跃度。
8. 如果 `SERVE_STATIC !== 'false'`，兼容旧 Koa 的前端静态资源托管逻辑。
9. 从 `PORT` 读取端口，默认监听 `3000`。

`src/app.module.ts` 是根模块，它只负责装配功能模块，不写具体业务逻辑。项目中的业务能力被拆成多个模块：

- `DatabaseModule`
- `PermissionsModule`
- `AuthModule`
- `DashboardModule`
- `CoursesModule`
- `StudentsModule`
- `SummaryModule`
- `SystemModule`
- `UploadModule`
- `StaticModule`

这种结构符合 NestJS 的典型分层方式：Controller 负责接收请求，Service 负责业务逻辑，TypeORM Repository 或 QueryBuilder 负责数据库访问。

## 五、环境变量配置

本地配置模板在 `.env.example`。真实本地配置放在 `.env`，并且 `.env` 已被 `.gitignore` 忽略，避免把数据库密码提交到仓库。

关键配置如下：

```env
PORT=3000
JWT_SECRET=change-me-in-production
SERVE_STATIC=false
DATA_ROOT=../server/data

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=eduflow_course_admin
MYSQL_CONNECTION_LIMIT=10

SQLITE_DB_PATH=../server/data/homework.db
```

各配置的含义：

| 配置 | 作用 |
| --- | --- |
| `PORT` | NestJS 服务端口 |
| `JWT_SECRET` | JWT 签名密钥 |
| `SERVE_STATIC` | 是否由 NestJS 托管前端静态资源 |
| `DATA_ROOT` | 上传文件根目录 |
| `MYSQL_HOST` | MySQL 地址 |
| `MYSQL_PORT` | MySQL 端口 |
| `MYSQL_USER` | MySQL 用户 |
| `MYSQL_PASSWORD` | MySQL 密码 |
| `MYSQL_DATABASE` | 业务数据库名 |
| `MYSQL_CONNECTION_LIMIT` | TypeORM 底层 MySQL 连接池大小 |
| `SQLITE_DB_PATH` | 旧 SQLite 数据库路径，只用于一次性迁移脚本 |

环境变量加载逻辑在 `src/config/load-env.ts`。应用优先读取 `.env`，缺失时兜底读取 `.env.example`。脚本侧使用 `scripts/load-env.mjs`，保持应用和脚本配置来源一致。

## 六、数据库设计与访问方式

数据库核心文件分为 5 类：

- `src/database/typeorm.config.ts`：读取 MySQL 环境变量、确保数据库存在、生成 TypeORM 配置。
- `src/database/entities/`：定义业务表和权限表对应的 Entity，是数据结构的代码入口。
- `src/database/migrations/1788134400000-create-initial-tables.ts`：创建初始表、索引和外键，兼容已有数据库。
- `src/database/database.init.ts`：首次启动补齐系统默认角色、权限、角色权限映射和默认账号。
- `src/database/recent-learning-activity.service.ts`：近 7 天学习活跃度暂无真实行为表时，每天按现有逻辑补齐一次。

### 1. 为什么采用 TypeORM

旧版 `server` 通过 Koa + SQLite 和手写 SQL 快速打通业务链路。迁移到 `server-nest` 后，后端模块增多，继续把所有 SQL 收敛在一个通用服务里会让实体结构、查询逻辑和迁移逻辑混在一起。

采用 TypeORM 的收益是：

- Entity 让表结构和字段类型在代码里可见。
- Repository 适合简单 CRUD，减少重复 SQL。
- QueryBuilder 适合分页、筛选、排序和统计聚合。
- Migration 让表结构变更可追踪、可回放。
- NestJS 依赖注入可以按模块注入所需 Repository，边界更清楚。

`mysql2` 仍然保留，但它是 TypeORM 的 MySQL 驱动。业务 Service 不直接使用 `mysql2/promise` 拼接 SQL。

### 2. Migration 和 Init 的分工

数据库结构和默认数据分开处理：

- Migration 负责表结构，包括表、字段、索引、外键和旧库兼容保护。
- Init 负责系统默认数据，包括 `admin`、`teacher`、`student` 角色权限和默认账号。
- 课程、学生、学习总结等业务数据不在初始化文件中写入，一律读取数据库已有数据。
- 近 7 天学习活跃度属于统计补齐逻辑，由 `RecentLearningActivityService` 每天刷新一次。

生产环境默认不自动执行 migration，需要通过部署流程执行，或显式设置 `TYPEORM_MIGRATIONS_RUN=true`。

### 3. Repository 和 QueryBuilder

业务模块的典型访问方式如下：

```ts
@InjectRepository(CourseEntity)
private readonly courseRepository: Repository<CourseEntity>
```

简单查询使用 Repository：

```ts
await this.courseRepository.findOneBy({ id: courseId });
await this.courseRepository.countBy({ status: 'published' });
```

复杂列表和统计使用 QueryBuilder：

```ts
this.courseRepository
  .createQueryBuilder('course')
  .where('course.status = :status', { status: 'published' })
  .orderBy('course.student_count', 'DESC')
  .getMany();
```

多表或多步骤写入使用 TypeORM transaction，保证失败时回滚。

### 4. MySQL 表结构

当前保留的核心表如下：

| 表名 | 作用 |
| --- | --- |
| `users` | 后台账号，包含用户名、密码、昵称、角色 |
| `courses` | 课程数据 |
| `course_categories` | 课程分类字典，使用 UUID 主键并维护分类课程数 |
| `students` | 学员数据，`course_ids` 保存选课关系 |
| `learning_records` | 学习记录，用于工作台趋势统计 |
| `learning_summaries` | 学习总结/笔记 |
| `roles` | 角色表，包含内置角色和自定义角色 |
| `permissions` | 权限码字典 |
| `role_permissions` | 角色和权限码的映射关系 |

MySQL 迁移时的主要语法变化：

- `INTEGER PRIMARY KEY AUTOINCREMENT` 改为 `INT AUTO_INCREMENT PRIMARY KEY`。
- `TEXT` 保留为 MySQL `TEXT`。
- `DATETIME DEFAULT CURRENT_TIMESTAMP` 替代 SQLite 时间默认值写法。
- 课程分类 `created_at` 使用 `DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)`，保证同一秒内连续新增时仍能按新增顺序稳定排序。
- 布尔含义字段使用 `TINYINT(1)`。
- 权限映射表使用联合主键：`PRIMARY KEY (role_code, permission_code)`。
- 外键关系使用 InnoDB 约束维护关联删除。

## 七、请求处理链路

一次典型的受保护请求，例如 `GET /api/courses`，执行链路如下：

```text
前端 Axios 请求
  ↓
main.ts 中的 NestJS 应用
  ↓
JwtAuthGuard 校验 token
  ↓
PermissionsGuard 校验接口权限码
  ↓
CoursesController 接收参数
  ↓
CoursesService 执行业务逻辑
  ↓
TypeORM Repository / QueryBuilder 访问 MySQL
  ↓
ok() 封装 { code, msg, data }
  ↓
返回前端
```

如果业务中抛出 `ApiException` 或普通异常，会被 `ApiExceptionFilter` 统一处理，保证前端仍拿到旧接口格式。

## 八、统一响应与异常处理

统一响应在 `src/common/api-response.ts`：

```ts
ok(data, msg = '操作成功')
```

返回结构固定为：

```json
{
  "code": 0,
  "msg": "操作成功",
  "data": {}
}
```

业务失败通过 `fail(status, msg)` 抛出 `ApiException`。异常过滤器会把错误转换成：

```json
{
  "code": 403,
  "msg": "无权限执行该操作",
  "data": null
}
```

这种设计的重点是：NestJS 内部可以使用标准异常机制，但对前端暴露的响应结构仍然保持旧 Koa 版本兼容。

## 九、双 Token 登录与 JWT 鉴权

认证由短期 `Access Token` 和长期 `Refresh Token` 协作完成：Access Token 只保存在前端内存，15 分钟过期；Refresh Token 放在 `HttpOnly`、`SameSite=Lax` Cookie 中，不会暴露给前端 JavaScript。MySQL 的 `refresh_tokens` 表只保存 Refresh Token 的 SHA-256 哈希，用于维护服务端会话。

登录入口为 `POST /api/auth/login`。`AuthService.login` 会校验账号密码、计算用户权限、创建会话记录，返回 Access Token、用户信息与权限集合，同时写入 Refresh Token Cookie。

前端访问受保护接口时携带：

```http
Authorization: Bearer <accessToken>
```

当 Access Token 过期，Axios 会通过 `POST /api/auth/refresh` 携带 Cookie 刷新。后端校验会话后签发新的 Access Token 和新的 Refresh Token；旧 Refresh Token 立即作废。这种令牌轮换机制使被重放的旧 Refresh Token 能被识别，并会撤销同一会话族，要求重新登录。

Refresh Token 同时受两类有效期限制：24 小时未使用即闲置过期，单次会话最长存活 7 天。`POST /api/auth/logout` 撤销当前会话，`POST /api/auth/logout-all` 和修改密码会撤销用户全部会话。`JwtAuthGuard` 除了校验 JWT 签名、类型和过期时间，还会检查关联会话是否仍有效，因此退出后旧 Access Token 也会立即失效。

## 十、RBAC 动态权限设计

权限系统是这个项目最重要的亮点。它不是简单写死 `admin/teacher/student`，而是通过 RBAC 和权限码实现动态角色权限。

### 1. 核心表关系

```text
users.role
  ↓
roles.code
  ↓
role_permissions.role_code
  ↓
permissions.code
```

含义如下：

- 用户只保存当前角色 code。
- 角色信息保存在 `roles` 表。
- 权限码保存在 `permissions` 表。
- 角色拥有的权限通过 `role_permissions` 表维护。

### 2. 权限码字典

权限码集中维护在 `src/permissions/permissions.constants.ts`。

权限码不是随便散落在业务代码里，而是按模块分组，例如：

- 工作台：`dashboard:view`
- 课程：`courses:view`、`courses:create`、`courses:update`、`courses:delete`
- 学员：`students:view`、`students:create`、`students:update`、`students:delete`
- 学习总结：`summary:view`、`summary:create`、`summary:update`、`summary:delete`
- 账号管理：`accounts:view`、`accounts:updateRole`

这些权限码同时服务 4 层权限控制：

- 前端菜单展示。
- 前端路由访问。
- 前端按钮显示和操作。
- 后端接口鉴权。

### 3. 接口权限控制

接口通过 `@RequirePermission()` 标记所需权限，例如：

```ts
@Get()
@RequirePermission(PERMISSIONS.COURSES_VIEW)
async list() {}
```

`PermissionsGuard` 会读取这个元数据，然后校验当前用户是否拥有该权限。

关键点是：`PermissionsGuard` 每次请求都会重新查询数据库中的用户角色和角色权限，而不是完全信任 JWT 里的旧权限。

这样管理员修改某个用户或角色权限后：

1. 用户旧 token 仍然可以代表“这个人是谁”。
2. 但接口权限会按数据库最新角色重新计算。
3. 下一次访问受保护接口时，新权限立即生效。
4. 如果权限被取消，接口会返回 403。

这就是“动态权限”的关键执行逻辑。

### 4. 自定义角色

系统管理模块支持自定义角色：

- 新增角色。
- 修改角色名称和描述。
- 删除可删除角色。
- 保存角色权限集合。
- 查询角色列表时带上每个角色的权限集合。

这些逻辑主要在：

- `SystemController`
- `SystemService`
- `PermissionService`

内置角色如 `admin` 不允许被删除，避免系统最高权限入口被误删。

## 十一、业务模块说明

### 1. Dashboard 模块

`DashboardModule` 提供首页工作台统计。

主要返回：

- 课程总数。
- 学员总数。
- 已发布课程数。
- 学习记录数。
- 课程状态分布。
- 最近 7 天学习活跃度。

其中课程、学员和分类分布由 `DashboardService` 聚合；近 7 天学习活跃度由数据层 `RecentLearningActivityService` 维护，数据库暂无真实学习行为表时按自然日每日补齐一次。

### 2. Courses 模块

课程模块提供：

- 课程列表分页。
- 关键字、状态、分类筛选。
- 表格排序。
- 分类下拉列表。
- 课程详情。
- 新增课程。
- 编辑课程。
- 删除课程。
- 上下架状态切换。

课程新增成功时保留旧 Koa 接口的 `201` 状态语义。

课程分类已经拆为独立字典表：`courses.category_id` 指向 `course_categories.id`，`courses.category` 仍保存分类名称快照。这样正常业务操作通过分类外键保证一致性；如果分类被数据库层直接删除，外键可置空，列表仍能用名称快照兜底展示。

课程创建、编辑、删除会同步维护 `course_categories.course_count`。编辑分类名称时，后端会同步更新已关联课程的分类名称快照，避免外键和展示名称不一致。

### 3. Course Categories 模块

课程分类模块提供：

- 分类列表和按名称模糊查询。
- 新增分类。
- 编辑分类名称。
- 删除未被课程使用的分类。

权限复用课程编辑能力：查询分类需要 `courses:view`，新增、编辑、删除分类需要 `courses:update`。删除前会按 `courses.category_id` 重新计算真实课程数量，已有课程时返回 400，不依赖前端按钮禁用作为安全边界。

前后端接口字段和请求示例见 `server-nest/docs/Client 与 server-nest 接口协议文档.md`。

### 4. Students 模块

学员模块提供：

- 学员列表分页。
- 班级筛选。
- 学号重复校验。
- 学员详情。
- 新增学员。
- 编辑学员。
- 删除学员。
- 学员选课关系维护。
- 课程人数重新计算。

因为 `students.course_ids` 存的是 JSON 字符串，所以 Service 会负责把它转换成前端需要的数组结构。

### 5. Summary 模块

学习总结模块提供：

- 当前用户的总结列表。
- 当前用户的总结详情。
- 新增总结。
- 编辑总结。
- 删除总结。

这个模块有一个重要边界：总结数据按 `user_id` 隔离，用户只能操作自己的学习总结，不能通过 ID 越权访问别人的总结。

### 6. Upload 和 Static 模块

上传模块用于学习总结图片上传。

执行流程：

1. 前端上传图片到 `/api/upload/summary-image`。
2. 后端解析 multipart 图片。
3. 文件保存到 `DATA_ROOT/uploads/summary/<userId>/`。
4. 接口返回 `/api/static/uploads/summary/...` 形式的 URL。
5. 前端把 URL 写入 Markdown 内容。
6. 静态资源模块负责后续图片访问。

静态资源模块会做路径和文件类型校验，避免直接读取任意文件。

### 7. System 模块

系统管理模块承载后台账号、角色和权限配置。

主要接口包括：

- 用户列表。
- 修改用户角色。
- 创建后台用户。
- 删除后台用户。
- 角色列表。
- 新增自定义角色。
- 修改角色信息。
- 删除角色。
- 权限字典查询。
- 保存角色权限。

其中角色配置属于高风险操作，除了权限码校验之外，还要求当前登录用户真实角色是 `admin`。

## 十二、SQLite 到 MySQL 迁移

迁移脚本是：

```bash
npm run db:migrate:mysql
```

对应文件：

```text
scripts/migrate-sqlite-to-mysql.mjs
```

它会读取旧 SQLite 数据库，把数据写入 MySQL，迁移范围包括：

- `users`
- `courses`
- `students`
- `learning_records`
- `learning_summaries`
- `roles`
- `permissions`
- `role_permissions`

迁移时需要保证：

- 主键 ID 保持不变。
- 角色和权限映射不丢失。
- 学习总结和上传图片引用不丢失。
- 自定义角色能迁移到 MySQL。

迁移后可运行：

```bash
npm run db:verify
```

该脚本会统计 MySQL 中关键表的数据量，并输出自定义角色数量，用于快速判断迁移结果。

## 十三、测试与验收

项目重点不是只看服务能不能启动，而是要确认“前端调用是否仍然兼容、数据库初始化是否幂等、migration 是否可重复执行”。因此当前提供了后端测试：

```bash
npm test -- --verbose
```

测试覆盖内容包括：

- 管理员登录。
- `/auth/me` 恢复当前用户和权限。
- 登录失败错误格式。
- Access Token 的 15 分钟有效期与 Refresh Token Cookie 安全属性。
- Refresh Token 轮换、旧令牌重放检测及会话撤销后 Access Token 立即失效。
- 学生账号访问账号管理被拒绝。
- 工作台、课程、学员列表响应结构。
- 学习总结 CRUD 和用户隔离。
- 自定义角色和权限配置。
- 管理员高风险角色操作保护。
- 修改角色权限后，旧 token 下一次请求立即按新权限鉴权。
- 课程新增、编辑、状态切换、删除。
- 学员学号校验、详情课程展开、课程人数重算。
- 图片上传和 `/api/static` 图片访问。
- 静态文件安全检查。
- TypeORM 配置在生产环境默认不自动跑 migration。
- 默认角色、权限、角色权限映射和账号只在缺失时补齐。
- 手动调整后的角色权限不会在重启后被默认初始化覆盖。
- 近 7 天学习活跃度按本地自然日补齐。
- migration 遇到旧库脏引用时跳过外键创建，避免启动被历史数据阻断。
- 日期时间格式化不做固定时区偏移，避免重复加时区。

推荐每次修改后至少运行：

```bash
npm run build
npm run db:verify
npm test -- --verbose
```

这 3 个命令分别验证：

- TypeScript 能否编译。
- MySQL 数据是否可访问且核心表数据存在。
- API 路径、请求参数、响应结构、鉴权、权限逻辑、初始化和 migration 是否仍然兼容。

## 十四、如何学习这个项目

建议按下面顺序学习：

1. 先看 `src/main.ts`，理解应用启动、跨域、异常过滤器、静态资源托管。
2. 再看 `src/app.module.ts`，理解 NestJS 模块装配。
3. 看 `src/database/typeorm.config.ts`、`src/database/entities/` 和 `src/database/migrations/1788134400000-create-initial-tables.ts`，理解 TypeORM 连接、实体和建表方式。
4. 看 `src/database/database.init.ts` 和 `src/database/recent-learning-activity.service.ts`，理解默认系统数据和近 7 天活跃度为什么分开。
5. 看 `src/auth/auth.service.ts`、`src/auth/auth.controller.ts`、`src/auth/auth.guard.ts` 和 `src/database/entities/refresh-token.entity.ts`，理解双 Token 登录、会话轮换和 JWT 鉴权。
6. 看 `src/auth/permissions.guard.ts` 和 `src/permissions/permission.service.ts`，理解动态权限如何实时生效。
7. 选一个业务模块，例如 `courses`，按 Controller -> Service -> Repository/QueryBuilder 的顺序读。
8. 看 `test/auth-session.e2e-spec.ts`、`test/api-contract.e2e-spec.ts`、`test/database-init.e2e-spec.ts` 和 `test/migration.e2e-spec.ts`，理解会话安全与迁移后必须保持不变的接口契约。
9. 最后看 `scripts/migrate-sqlite-to-mysql.mjs`，理解数据迁移时如何保持主键和关联关系。

## 十五、DTO 与 ValidationPipe

当前后端已经补充 DTO 和全局 `ValidationPipe`。Controller 不再直接接收大面积 `Record<string, unknown>` 或临时内联 body 类型，而是按模块接收明确 DTO，例如 `LoginDto`、`CreateCourseDto`、`CreateStudentDto`、`CreateSummaryDto`、`CreateUserDto` 等。

职责划分如下：

- DTO：负责基础字段形态、必填、枚举、手机号、邮箱、分页数字转换等校验。
- `ValidationPipe`：负责启用 `transform` 和 `whitelist`，把 query string 转成 DTO 声明的类型，并剥离未声明字段。
- `ApiException`：负责让 DTO 校验失败继续返回旧接口结构 `{ code: 400, msg, data: null }`。
- Service：继续负责数据库相关业务校验，例如用户名是否重复、学号是否重复、课程是否存在、角色是否可分配、当前用户是否能访问某条总结。

为了保持旧接口兼容，本次没有给路由 `id` 使用 Nest 内置 `ParseIntPipe`。非法路由 ID 仍然由 `parsePositiveIntId()` 处理，保持原来的 404 语义。

新增依赖：

```text
class-validator
class-transformer
```

这些依赖放在 `dependencies` 中，因为生产运行时也需要 DTO 校验。

## 十六、后续扩展建议

如果后续继续优化，可以考虑：

- 为更多业务 Service 增加聚焦 Repository/QueryBuilder 的单元测试。
- 将权限码和前端菜单配置生成逻辑进一步统一，减少手工同步成本。
- 给 `updated_at` 增加自动更新时间策略。
- 把上传文件校验扩展为文件大小限制和 MIME 白名单。
- 生产环境将 `JWT_SECRET` 改成强随机值。
- Docker 部署时用独立 MySQL 容器或外部 MySQL，并通过环境变量注入配置。

当前版本的重点是“迁移成功、接口兼容、权限闭环完整”。在这个基础上继续优化，风险会比一边迁移一边重构小很多。
