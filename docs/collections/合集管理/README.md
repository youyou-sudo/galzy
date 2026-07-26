# 合集管理

**状态：** 进行中

## 设计结论

后台管理 CRUD 合集，支持两种条目来源：手动输入游戏列表 + 绑定会社动态拉取。前台展示合集列表和详情。

## 动机

提供一个"合集"功能，让运营可以自由组织游戏列表（如"2024 年最佳纯爱作"、"Key 社全作品"等），提升内容组织能力和用户浏览体验。

## 设计决策

1. **数据库：** 扩展现有 `galrc_collections` 表（已定义但未建表），新增 `galrc_collection_entries` 表
2. **两种模式互斥：**
   - `manual` 模式：后台手动在 `collection_entries` 表添加 vid 条目，支持拖拽排序
   - `producer` 模式：通过 `producer_ids` (jsonb) 绑定会社，前端动态查询该会社下所有游戏
3. **API 统一路由：** 遵循现有 topics 模块模式，公开/管理路由共用 `/collections` 前缀，通过 `auth: true` 区分权限
4. **前台页面：** 合集列表页 `/collections`、合集详情页 `/collections/$id`
5. **管理页面：** `/admin/collections`，遵循现有 admin 模式（薄路由 + 独立组件 + server functions）

## 变更历史

| 日期       | 变更     | 原因 |
| ---------- | -------- | ---- |
| 2026-07-26 | 初始设计 | —    |

## 实施任务

### 任务 1：数据库 Schema + 迁移

**文件：** `apps/api/src/db/schema/services.ts`

- 扩展 `collections` 表：加 `type`、`producer_ids`、`status`、`sort_order`、`created_at`、`updated_at`
- 重命名/扩展 `collectionsItems` 为 `collectionEntries`：加 `sort_order`、`created_at`
- 运行 `bun run db:generate` 生成迁移

### 任务 2：API 模块

**文件：** `apps/api/src/modules/collections/model.ts`、`service.ts`、`index.ts`

- 遵循 `namespace CollectionModel` + `CollectionService` 对象字面量模式
- 路由：`GET /collections`、`GET /collections/:id`、`POST /collections`、`PUT /collections/:id`、`DELETE /collections/:id`、`PUT /collections/:id/entries`

### 任务 3：前端 Server Functions

**文件：** `apps/web-tanstack/src/server/admin/collections.ts`、`apps/web-tanstack/src/server/collections.ts`

- 遵循 `createServerFn` + `api` (Eden Treaty) 模式

### 任务 4：后台管理页

**文件：** `apps/web-tanstack/src/components/admin/collections-page.tsx`、`apps/web-tanstack/src/routes/admin/_authL/collections.tsx`

- 薄路由 + 独立页面组件模式

### 任务 5：前台展示页

**文件：** `apps/web-tanstack/src/routes/collections/index.tsx`、`apps/web-tanstack/src/routes/collections/$id.tsx`
