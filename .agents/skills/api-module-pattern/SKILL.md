---
name: api-module-pattern
description: 项目 API 模块三体结构、TypeBox 命名空间、Service 对象、Kysely 查询、Redis 缓存、Auth 宏等编码惯例。应用于 apps/api/src/modules/ 下的所有模块。
---

# API 模块模式 — GalZY (Aqua)

本项目 API 基于 **ElysiaJS**，采用 **模块三体结构**（controller + model + service）。每条规则均从实际代码库中提炼。

## 何时应用

- 在 `apps/api/src/modules/` 下创建或修改模块
- 编写 TypeBox 校验 schema
- 编写 Kysely 数据库查询
- 添加 Redis 缓存
- 使用 `auth` / `isAdmin` 宏保护路由
- 处理错误并返回一致格式
- 使用 Eden Treaty 暴露类型

## 目录结构

每个功能模块包含三个文件，职责严格分离：

```
modules/comments/
├── index.ts      # 路由层（Controller）— 处理 HTTP，调用 Service
├── model.ts      # 数据模型层 — TypeBox schema + 派生类型
└── service.ts    # 业务逻辑层 — 纯逻辑，不依赖 HTTP 上下文
```

## 1. 模块三体结构

### 1.1 Model — TypeBox 命名空间模式

使用 `namespace` 包裹 schema 和派生类型。所有 schema 使用 `t`（from `elysia`），导出类型用 `typeof X.static`。

**文件**: `apps/api/src/modules/comments/model.ts`

```typescript
import { t } from 'elysia'

export namespace CommentModel {
  export const List = t.Object({
    targetType: t.Optional(t.String()),
    targetId: t.Optional(t.String()),
    page: t.Optional(t.Number({ default: 1 })),
    limit: t.Optional(t.Number({ default: 20 })),
    type: t.Optional(t.String()),
    status: t.Optional(t.String()),
    excludeReplies: t.Optional(t.Boolean()),
  })

  export const Create = t.Object({
    targetType: t.String(),
    targetId: t.String(),
    content: t.String({ minLength: 1 }),
    type: t.Optional(t.String()),
    parentId: t.Optional(t.Nullable(t.String())),
    replyToUserId: t.Optional(t.Nullable(t.String())),
  })

  export const Params = t.Object({
    id: t.String(),
  })

  // 派生类型 — 用于 Service 方法签名
  export type list = typeof List.static
  export type create = typeof Create.static
  export type params = typeof Params.static
}
```

规则：
- `t` 从 `'elysia'` 导入，**不是** `'@sinclair/typebox'`
- 所有 schema 定义为 `export const`
- 类型定义为 `export type foo = typeof Foo.static`
- 可选字段用 `t.Optional(...)`
- 可空字段用 `t.Optional(t.Nullable(...))`
- 带默认值用 `t.Number({ default: 10 })`
- 最小长度用 `t.String({ minLength: 1 })`

### 1.2 Service — 对象方法模式

Service 导出为**对象字面量**（不是 class），方法为 `async` 箭头函数。

**文件**: `apps/api/src/modules/comments/service.ts`

```typescript
import { db } from '@api/libs'
import { status } from 'elysia'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import type { CommentModel } from './model'

export const CommentService = {
  // 查询列表
  async getComments({
    targetType,
    targetId,
    page = 1,
    limit = 20,
  }: CommentModel.list) {
    let query = db
      .selectFrom('galrc_comments')
      .selectAll('galrc_comments')
      .where('status', '=', 'normal')

    if (targetType) {
      query = query.where('targetType', '=', targetType as 'post' | 'article' | 'game')
    }

    const [comments, countResult] = await Promise.all([
      query
        .orderBy('createdAt', 'desc')
        .offset((page - 1) * limit)
        .limit(limit)
        .execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .select(db.fn.countAll<number>().as('total'))
        .executeTakeFirst(),
    ])

    return {
      comments,
      total: countResult?.total ?? 0,
      totalPages: Math.ceil((countResult?.total ?? 0) / limit),
    }
  },

  // 创建评论
  async createComment(
    { targetType, targetId, content }: CommentModel.create,
    userId: string,
  ) {
    const inserted = await db
      .insertInto('galrc_comments')
      .values({
        targetType: targetType as 'post' | 'article' | 'game',
        targetId,
        userId,
        content,
        createdAt: new Date().toISOString(),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow()

    return inserted
  },
}
```

规则：
- 导出 `export const X = { ... }`，**不是** `export class X`
- 方法签名**解构**参数，使用 Model 派生类型做类型标注
- 数据库操作通过 `db`（Kysely 实例）访问
- 分页：`offset((page - 1) * limit).limit(limit)`
- 计数：`db.fn.countAll<number>().as('total')` + `clearSelect().clearOrderBy()`
- 并行查询：`Promise.all([query, countQuery])`
- 排序：`.orderBy('createdAt', 'desc')`

### 1.3 Controller — 路由处理模式

Controller（index.ts）负责：路由定义、请求校验、调用 Service。

**文件**: `apps/api/src/modules/comments/index.ts`

```typescript
import { betterAuth } from '@api/modules/auth'
import { CommentModel } from '@api/modules/comments/model'
import { CommentService } from '@api/modules/comments/service'
import { Elysia } from 'elysia'

export const comments = new Elysia({ prefix: '/comments' })
  .use(betterAuth)
  .get(
    '/',
    async ({ query }) => {
      return await CommentService.getComments(query)
    },
    {
      query: CommentModel.List,
    },
  )
  .post(
    '/',
    async ({ body, user }) => {
      return await CommentService.createComment(body, user.id)
    },
    {
      auth: true,           // 需要登录
      body: CommentModel.Create,
    },
  )
  .delete(
    '/:id',
    async ({ params, user }) => {
      return await CommentService.deleteComment(params, user.id)
    },
    {
      auth: true,
      params: CommentModel.Params,
    },
  )
  .patch(
    '/:id/pin',
    async ({ params }) => {
      return await CommentService.togglePin(params)
    },
    {
      isAdmin: true,        // 需要管理员
      params: CommentModel.Params,
    },
  )
```

规则：
- 每个模块导出独立的 `Elysia` 实例：`export const x = new Elysia({ prefix: '...' })`
- 使用方法**链式调用**，不要变量赋值
- **先调用**需要依赖的 `.use(betterAuth)` 再定义路由
- 路由 handler 中**解构** `{ query, body, params, user }`
- handler 保持**极薄**：仅解参 + 调 Service + return
- 校验 schema 放在第三个参数对象中
- 权限宏放在 schema 对象的同一层级：`{ auth: true }` 或 `{ isAdmin: true }`

## 2. Auth 宏 — Better Auth 集成

Auth 宏在 `modules/auth/index.ts` 中定义一次，全局可用。

**文件**: `apps/api/src/modules/auth/index.ts`

```typescript
import { auth } from '@api/modules/auth/service'
import cors from '@elysiajs/cors'
import { Elysia } from 'elysia'

const allowedOrigins = ['http://localhost:3001', `${process.env.WEB_HOST}`]

export const betterAuth = new Elysia({ name: 'better-auth' })
  .use(cors({ origin: allowedOrigins, credentials: true, ... }))
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) throw status(401, '请先登录喵～')
        return session
      },
    },
    isAdmin: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) throw status(401, '请先登录喵～')
        if (session.user.role !== 'admin') throw status(403, '该用户不具有管理员权限喵～')
        return session
      },
    },
  })
```

使用方式：
```typescript
// 在路由定义中
{
  auth: true,     // → 自动调用 resolve，注入 { user, session } 到 context
}
{
  isAdmin: true,  // → 同上，但要求 role === 'admin'
}
```

## 3. Kysely 查询模式

### 3.1 JOIN + JSON 子查询

使用 `jsonArrayFrom` 和 `jsonObjectFrom` 将关联数据转换为嵌套 JSON。

**参考**: `apps/api/src/modules/tags/service.ts`

```typescript
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'

db
  .selectFrom('vn')
  .select((eb) => [
    jsonObjectFrom(
      eb
        .selectFrom('images')
        .select(['height', 'id', 'width'])
        .whereRef('images.id', '=', 'vn.c_image'),
    ).as('image'),
    jsonArrayFrom(
      eb
        .selectFrom('tags_vn')
        .whereRef('tags_vn.vid', '=', 'vn.id')
        .selectAll()
        .groupBy('tags_vn.tag'),
    ).as('tags'),
  ])
```

### 3.2 条件查询用 `$if`

```typescript
db
  .selectFrom('tags')
  .$if(!!keyword, (qb) =>
    qb.where((eb) =>
      eb.or([
        eb('name', 'like', `%${keyword}%`),
        eb('description', 'like', `%${keyword}%`),
      ]),
    ),
  )
  .$if(!!id, (qb) => qb.where('tags.id', 'like', `%${id}%`))
```

### 3.3 `try` 库安全执行

```typescript
import { t } from 'try'

const [, error, data] = t(
  await db.selectFrom('tags').selectAll().execute(),
)
if (error) {
  throw status(500, `服务出错了喵～ Error:${JSON.stringify(error)}`)
}
```

## 4. Redis 缓存模式

**参考**: `apps/api/src/modules/tags/service.ts`

```typescript
import { delKv, getKv, setKv } from '@api/libs/redis'

async gameTags({ id }: TagsModel.gameTags) {
  const cacheKey = `gameTags:${id}`

  // 1. 尝试缓存
  const redisData = await getKv(cacheKey)
  if (redisData) {
    try { return JSON.parse(redisData) as Tag } catch {
      await delKv(cacheKey).catch(() => {})
    }
  }

  // 2. 查数据库
  const items = await db.selectFrom(...).executeTakeFirst()
  if (!items) throw status(404, 'not found')

  const result = structuredClone(items)

  // 3. 写入缓存（异步，不阻塞）
  setKv(cacheKey, JSON.stringify(result), 60 * 60).catch(() => {
    console.warn(`缓存写入失败: ${cacheKey}`)
  })

  type Tag = NonNullable<typeof result>
  return result
}
```

## 5. 错误处理

使用 `status` 函数从 `elysia` 抛出 HTTP 错误。

```typescript
import { status } from 'elysia'

throw status(404, '评论不存在')
throw status(401, '请先登录喵～')
throw status(403, '该用户不具有管理员权限喵～')
throw status(500, `服务出错了喵～ Error:${JSON.stringify(error)}`)
```

## 6. 模块注册与 App 组装

**文件**: `apps/api/src/modules/index.ts` — 统一导出所有模块：

```typescript
export * from './auth'
export * from './comments'
export * from './cron'
export * from './games'
export * from './health'
export * from './media'
// ...
```

**文件**: `apps/api/src/index.ts` — 组装所有模块：

```typescript
import { Elysia } from 'elysia'
import { comments, health, tags, game, auth as betterAuth } from '@api/modules'

async function buildApp() {
  return new Elysia()
    .onError(({ code, error }) => {
      if (code === 'VALIDATION') return error.message
    })
    .use(betterAuth)
    .use(health)
    .use(tags)
    .use(game)
    .use(comments)
}

export type app = Awaited<ReturnType<typeof buildApp>>
```

## 7. 路径别名 (tsconfig)

```json
{
  "paths": {
    "@api": ["./src/index.ts"],
    "@api/*": ["./src/*"],
    "@libs/*": ["../../packages/libs/src/*"]
  }
}
```

## 8. 常用导入速查

| 用途 | 导入 |
|------|------|
| Elysia 核心 | `import { Elysia, t, status } from 'elysia'` |
| TypeBox 类型 | `import { t } from 'elysia'` **而非** `@sinclair/typebox` |
| DB 实例 | `import { db } from '@api/libs'` |
| Kysely JSON 辅助 | `import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'` |
| Redis 缓存 | `import { getKv, setKv, delKv } from '@api/libs/redis'` |
| Try 安全执行 | `import { t } from 'try'` |
| Auth 宏依赖 | `.use(betterAuth)` from `@api/modules/auth` |

## 反模式 (禁止)

```typescript
// ❌ 不导出 Elysia 实例，而是导出函数
export function setupRoutes(app: Elysia) { app.get(...) }  // 禁止

// ❌ Service 使用 class
export class CommentService { static async get() {} }  // 禁止

// ❌ Model 不使用 namespace
export const List = t.Object({...})  // 禁止 — 用 namespace 包裹

// ❌ 路由 handler 不解构
.get('/', (context) => context.query.name)  // 禁止

// ❌ 在 Service 中直接 throw Error 而非 status
throw new Error('not found')  // 禁止 — 用 throw status(404, ...)

// ❌ TypeBox 从 @sinclair/typebox 导入
import { Type } from '@sinclair/typebox'  // 禁止 — 用 import { t } from 'elysia'

// ❌ 不使用 $if 而用 if-else 拼接 query
if (keyword) query = query.where(...)  // 可用，但优先 $if
```
