# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

EduFlow 在线课程后台管理系统。React 19 + TypeScript + Ant Design 6 SPA 前端，Koa 2 + SQLite REST API 后端。功能包括数据看板、课程/学生 CRUD、Markdown 学习笔记、账号管理和 RBAC 权限控制。

## 开发命令

所有命令从项目根目录执行：

| 命令 | 说明 |
|------|------|
| `cd client && npm run dev` | 启动前端开发服务器 (port 5173, API 代理到 3000) |
| `cd server && npm run dev` | 启动后端开发服务器 (port 3000, 文件监听) |
| `cd client && npm run build` | 前端生产构建 (tsc 类型检查 + vite build) |
| `cd client && npm run lint` | 前端 ESLint 检查 |
| `cd client && npm run preview` | 预览生产构建 (port 4173) |
| `cd server && npm start` | 后端生产启动 |
| `cd server && node --test` | 运行后端测试 |
| `docker compose up --build -d` | Docker 容器化部署（构建并启动） |
| `docker compose logs -f` | 查看容器日志 |
| `docker compose down` | 停止并移除容器 |

前端开发需要同时运行 client 和 server 两个 dev 命令。Docker 部署仅用于部署验证，日常开发用 `npm run dev`。

## 目录结构

```
eduFlow-course-admin/
  client/                 # React SPA（独立的 package.json）
    src/
      api.ts              # 所有 API 调用集中定义
      App.tsx             # Ant Design ConfigProvider + 路由入口
      auth.ts             # localStorage token/user 存取
      constants.ts        # 应用常量
      main.tsx            # 挂载到 #root
      markdown.tsx        # Markdown 渲染 + 代码高亮组件
      permissions.ts      # 前端权限码常量（与 server 镜像）
      types.ts            # TypeScript 类型定义（实体、API 信封、查询/表单）
      components/
        echarts/          # ECharts 封装（核心为 chart-core.tsx 生命周期管理）
        feedback.tsx      # LoadingScreen / PanelLoading / EmptyState
        Permission.tsx    # 声明式权限门控组件（code / any + fallback）
        ui.tsx            # Card / StatCard / PaginationBar
      layouts/
        AppShell.tsx      # 后台主布局（侧边栏 + 顶栏 + 内容区 + 错误横幅）
      pages/
        LoginPage.tsx
        DashboardPage.tsx
        CoursesPage.tsx
        StudentsPage.tsx
        SummaryPage.tsx
        AccountsPage.tsx
        PermissionsPage.tsx
        ForbiddenPage.tsx
      router/
        routes.tsx        # createBrowserRouter 路由表
        nav-config.tsx    # 侧边栏菜单配置 + getFirstAccessibleRoute
        page-elements.tsx # React.lazy 懒加载页面 + Suspense
        provider.tsx      # RouterProvider + 启动鉴权初始化
        RequirePermission.tsx # 路由级权限守卫
        route-meta.ts     # pathname → RouteKey 映射
        use-router-auth.ts
      stores/             # Zustand 5 状态管理
        auth-store.ts     # 鉴权 + hasPermission/hasAnyPermission
        course-store.ts
        student-store.ts
        dashboard-store.ts
        summary-store.ts
        reset-registry.ts # 登出时重置所有业务 store
        store-error.ts    # 全局错误桥接（业务 store → auth store → AppShell Alert）
      style/
        base.css
        summary.css
      utils/
        pagination.ts     # pageAfterDelete 等分页工具
        request.ts        # Axios 实例 + token 拦截器
        text.ts
  server/                 # Koa 后端（独立的 package.json）
    src/
      index.js            # Koa 入口（中间件、路由、静态资源托管）
      permissions.js      # 权限码字典 + 默认角色/权限分组（后端权限权威来源）
      database/           # SQLite 连接 + 初始化/建表
      middleware/         # JWT 鉴权中间件 + requirePermission
      routes/             # auth / courses / students / dashboard / summary / system / upload / static
      services/           # 权限服务层
      utils/
    data/                 # SQLite 数据库文件 + 上传文件
```

## 路由结构

React Router v7，`createBrowserRouter`：

```
/login              → LoginPage（公开）
/                   → AppShell 布局（需登录）
  /dashboard        → DashboardPage  （权限: DASHBOARD_VIEW）
  /courses          → CoursesPage    （权限: COURSES_VIEW）
  /students         → StudentsPage   （权限: STUDENTS_VIEW）
  /summary          → SummaryPage    （权限: SUMMARY_VIEW）
  /accounts         → AccountsPage   （权限: ACCOUNTS_VIEW）
  /permissions      → PermissionsPage（权限: ACCOUNTS_VIEW）
  /403              → ForbiddenPage
*                   → 重定向到 /login
```

首页 `/` 自动重定向到当前用户第一个可访问的页面（`getFirstAccessibleRoute()`）。

## Zustand Store 模式

业务 store（course / student / dashboard / summary）遵循统一模式：

- `query` 状态 + `updateQuery(updater)` 触发重新查询
- `initializePage()` 并行获取列表数据和支持数据（如课程分类、班级列表）
- `draftKeyword` 独立于 `query.keyword`，仅在按回车/点搜索时同步，避免 debounce
- `submitForm()` 通过 `editingId` 区分创建/更新
- `deleteById()` 调用 `pageAfterDelete()` 修正删除最后一页最后一条后的页码
- 页面通过 `useShallow` 订阅最小状态切片避免重渲染
- 每个 store 通过 `registerStoreResetter()` 注册，logout 时 `resetAllStores()` 清空

**例外**：AccountsPage 和 PermissionsPage 不用 Zustand，直接用 `useState` + `useCallback` 管理本地状态。

## API 层

`client/src/utils/request.ts`：Axios 实例，baseURL `/api`，timeout 10s。

- **请求拦截器**：自动注入 `Authorization: Bearer <token>`
- **响应拦截器**：检查 `ApiEnvelope.code`，401 清除鉴权，`code !== 0` 抛出 `Error(msg)`
- **导出 `request<T>()`**：自动解包 `response.data.data`，返回类型为 `T`
- 所有后端 API 响应格式：`{ code: number, msg: string, data: T }`

`client/src/api.ts`：所有 API 函数集中定义，按模块分组（auth / dashboard / courses / students / summary / system）。列表查询用 `URLSearchParams` 构建，图片上传用 `FormData`。

Vite 开发代理（`client/vite.config.ts`）：`/api` → `http://localhost:3000`。

## RBAC 权限系统

项目采用前后端联动的动态 RBAC 权限体系，详细设计见根目录 `权限管理设计文档.md`。核心链路：

```txt
权限码字典
  -> roles / permissions / role_permissions 维护角色权限映射
  -> 登录或 /auth/me 动态下发 user.permissions
  -> 前端菜单、路由、按钮按权限控制
  -> 后端接口通过 JWT + requirePermission 再次鉴权
```

后端 `server/src/permissions.js` 维护权限码、默认角色、权限分组和权限依赖；`server/src/services/permission-service.js` 负责从数据库读取角色权限、创建自定义角色、更新角色权限、补齐权限依赖、保护 admin 不可变。前端 `client/src/permissions.ts` 是同名权限码镜像，用于类型提示和 UI 控制，最终安全边界仍以后端接口鉴权为准。

四层权限控制：

| 层级 | 位置 | 机制 |
|------|------|------|
| 菜单 | `nav-config.tsx` + `AppShell.tsx` | `navItems` 每项声明所需权限，无权限不显示 |
| 路由 | `RequirePermission.tsx` | 无权限跳转 `/403`，传递 `from` 和 `requiredPermission` |
| 按钮/组件 | `Permission.tsx` | `code`（单权限）或 `any`（任一满足），可选 `fallback` |
| 接口 | `authenticateToken` + `requirePermission` | 先校验 JWT，再按数据库中的最新角色计算权限并返回 403 |

内置角色：`admin`（始终拥有全部权限，不依赖 `role_permissions`，不可编辑/删除）、`teacher`、`student`。自定义角色通过 `PermissionsPage` 管理，支持创建、编辑说明、可视化勾选权限、删除未绑定用户的角色。

权限码采用 `module:action` 格式，例如 `courses:view`、`students:delete`、`accounts:updateRole`。写操作权限会自动补齐对应查看权限，例如保存 `courses:update` 时会补齐 `courses:view`，避免出现“能编辑但进不了页面”的权限组合。

## 鉴权流程

1. **启动初始化**：`provider.tsx` 挂载时调用 `initializeAuth()`，从 localStorage 读取 token，调用 `GET /auth/me` 验证并重新拉取用户最新权限。无 token 或过期则清除并显示登录页。用 `initializePromise` 单例防止重复初始化。
2. **登录**：`LoginPage` → `POST /auth/login` → 后端校验密码并签发 JWT → `getEffectivePermissions(user)` 计算权限集合 → localStorage 持久化 token + user → store 更新。
3. **前端消费权限**：`auth-store` 提供 `hasPermission/hasAnyPermission`；菜单、路由守卫和按钮组件统一读取 `user.permissions`。
4. **接口鉴权**：所有核心业务接口使用 `authenticateToken` 校验登录态，再使用 `requirePermission(permission)` 校验接口权限。权限中间件会按 `ctx.state.user.id` 重新查库获取当前角色，避免旧 token 携带过期角色导致越权。
5. **登出**：`clearAuth()` + `resetAllStores()`（清空所有 Zustand store）。
6. **401 响应**：Axios 响应拦截器自动清除鉴权。

## 权限管理接口

`server/src/routes/system.js` 提供账号、角色和权限字典接口：

| 接口 | 权限 | 说明 |
|------|------|------|
| `GET /api/system/users` | `accounts:view` | 查看账号列表，并返回账号有效权限 |
| `POST /api/system/users` | `accounts:updateRole` | 新增普通账号，初始密码 `123456` |
| `PATCH /api/system/users/:id/role` | `accounts:updateRole` | 修改普通账号角色 |
| `DELETE /api/system/users/:id` | `accounts:updateRole` | 删除普通账号 |
| `GET /api/system/roles` | `accounts:view` | 获取角色列表 |
| `POST /api/system/roles` | `accounts:updateRole` + admin | 创建自定义角色 |
| `PATCH /api/system/roles/:code` | `accounts:updateRole` + admin | 修改角色名称/说明 |
| `DELETE /api/system/roles/:code` | `accounts:updateRole` + admin | 删除未绑定用户的自定义角色 |
| `GET /api/system/permissions` | `accounts:view` | 获取按模块分组的权限字典 |
| `PATCH /api/system/roles/:code/permissions` | `accounts:updateRole` + admin | 更新角色权限 |

`+ admin` 表示除了权限码校验外，还要求当前登录用户角色必须是 `admin`。

## ECharts 集成

`components/echarts/chart-core.tsx` 使用模块化导入（仅注册 Bar / Line / Pie / Grid / Graphic / Legend / Tooltip + CanvasRenderer）减小打包体积。每个图表的业务组件纯展示：接收数据 props，`useMemo` 计算 option，传给 `ChartContainer`。

## 页面懒加载

`router/page-elements.tsx` 中所有页面用 `React.lazy(() => import(...))` 代码拆分，包裹 `<Suspense fallback={<LoadingScreen />}>`。

## 关键约定

- 权限码为 `module:action` 格式（如 `courses:view`、`students:delete`）
- 前端 `PermissionCode` 类型从 `PERMISSIONS` 常量对象自动推导
- 权限数据落库在 `roles`、`permissions`、`role_permissions`，角色权限变更后通过 `/auth/me` 或重新登录刷新到前端
- 新增写操作权限时，需要在 `PERMISSION_DEPENDENCIES` 中配置对应 `:view` 依赖
- 后端接口权限必须通过 `requirePermission()` 兜底，前端 `Permission` 组件只负责展示体验
- 数据库文件位于 `server/data/homework.db`，SQLite + WAL 模式
- 新建普通账号初始密码统一为 `123456`，不能创建或分配 `admin` 角色
- 课程状态切换用 `PATCH /api/courses/:id/status`，不经过完整 update

<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文 review 沟通参考——话术模板、分级标注（必须修复/建议修改/仅供参考）、国内团队常见反模式应对。仅在用户显式 /chinese-code-review 时调用，不要根据上下文自动触发。
- **chinese-commit-conventions**: 中文 commit 与 changelog 配置参考——Conventional Commits 中文适配、commitlint/husky/commitizen 中文模板、conventional-changelog 中文配置。仅在用户显式 /chinese-commit-conventions 时调用，不要根据上下文自动触发。
- **chinese-documentation**: 中文文档排版参考——中英文空格、全半角标点、术语保留、链接格式、中文文案排版指北约定。仅在用户显式 /chinese-documentation 时调用，不要根据上下文自动触发。
- **chinese-git-workflow**: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发，或在执行实现计划之前使用——通过原生工具或 git worktree 回退机制确保隔离工作区存在
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->
