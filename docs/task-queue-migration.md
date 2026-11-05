# Galzy 任务队列迁移方案（@stacksjs/bun-queue）

> 状态：已按评审意见修订 v2（未落代码）
> 目标：把 VNDB 数据同步、Meilisearch 索引同步、Cloudreve 文件名→VNDB ID 同步这三条数据管道，从「croner 定时 + 手动 `void` 即发即忘 + Redis 锁 + 自建进度」迁移到统一的任务队列。

## 已确认的决策（评审定案）

| # | 议题 | 决策 | 影响 |
|---|------|------|------|
| 1 | dev 无 Redis 时 | **直接不启动队列，也不用 croner**（生产才启队列；dev 手动触发降级为同步执行或忽略） | §2.4、§5 |
| 2 | meili 重建 | **滚动增量，不清空不重建**（消除用户短暂空数据） | §4 重写 |
| 3 | 队列 key 前缀 | **`galzy-queue`** | §2.3 |
| 4 | croner 兜底 | **否**（迁移完成后移除 croner） | §5 |
| 5 | 任务日志/进度查看 | **自建 job 日志表（DB 持久化）+ 进度/状态接口** | §6 新增 |
| — | Worker 形态 | **直接同进程内嵌 Worker**（Dokploy 单服务模式） | §3 |

---

## 0. 选型结论

| 对象 | 结论 |
|------|------|
| 队列库 | **`@stacksjs/bun-queue`（`^0.1.8`）** |
| Redis 客户端 | **复用 Bun 自带 `bun:sql` redis（`bun` 的 `RedisClient`），零 ioredis、零新运行时依赖** |

**已从源码/类型实证（非猜测）：**

- `@stacksjs/bun-queue@0.1.8` 的 `package.json`：`dependencies: {}`、`peerDependencies: {}`——零运行时依赖。
- `dist/*.d.ts` 全部 `import type { RedisClient } from 'bun'`——Redis 客户端就是 Bun 内置类型。
- `Queue` 构造：`new Queue(name, { redis: { client: RedisClient } })`——可直接注入项目现有的 `getRedisClient()` 实例。
- `dist/commands/*.lua` 含 100+ BullMQ 同款分片 Lua 脚本（`addStandardJob`、`moveToFinished`、`moveStalledJobsToWait`、`rateLimit`、`updateProgress`…）——生产级原子语义，非玩具。

**为何弃用其它候选：**

| 候选 | 弃用原因 |
|------|---------|
| BullMQ | 硬性要求 ioredis/node-redis；违背「只用 Bun 自带 redis」的诉求 |
| `bunmq` | `0.0.3-dev.2`、直发 `.ts`、零依赖单人社，未验证不可用 |
| 自研 `SKIP LOCKED` / Redis LIST | 重试/进度/调度/限流都要自己写，且 bun-queue 已覆盖 |

**已知风险：**`@stacksjs/bun-queue` 仍是 `0.x`（`0.1.8`），API 可能有小范围 breaking change。措施：锁定精确版本 + 本项目内做一层薄封装 `@api/libs/queue`，隔离第三方 API，便于后续升级。

---

## 1. 目标：把「定时 / 手动触发」统一为「入队 + Worker」

### 现有触发点清单（迁移映射）

| # | 现有入口 | 文件 | 触发方式 | 迁往 bun-queue |
|---|---------|------|---------|---------------|
| 1 | `workerDataPull` | `cron/index.ts` | croner `*/1 * * * *` | `scheduleCron('*/1 * * * *')` |
| 2 | `cloudreveSyncScript` | `cron/index.ts` | croner `*/30 * * * *` + GET `/task/cloudreveSyncScript` + POST `/vndb-sync/cloudreve/sync` | `scheduleCron('*/30 * * * *')` + 手动入队 |
| 3 | `meiliSearchAddIndex`（game） | `cron/index.ts` | croner `0 3 * * 0` + GET `/task/meiliSearchAddIndex` | `scheduleCron('0 3 * * 0')` + 手动入队 |
| 4 | `meiliSearchAddTag` | `cron/index.ts` | croner `0 3 * * 0` + GET | 同上 |
| 5 | `meiliSearchAddProducer` | `cron/index.ts` | croner `0 3 * * 0` + GET | 同上 |
| 6 | `vndb syncFull` | `vndb-sync/index.ts` | POST `/vndb-sync/full` + `void` | 手动入队 |
| 7 | `vndb syncDelta` | `vndb-sync/index.ts` | POST `/vndb-sync/delta` + `void`；另被 `cloudreveSyncScript` 末尾 `void` 触发 | 手动入队 + 队列内 `dependsOn` 依赖 |
| 8 | `vndb syncProducersFromDb` | `vndb-sync/index.ts` | POST `/vndb-sync/producers` + `void` | 手动入队 |

### 关键语义替换

| 现状 | 现状问题 | bun-queue 替代 |
|------|---------|---------------|
| `void fn()` 即发即忘 | 无法感知失败/重试/持久化，重启丢任务 | `queue.add()` 返回 `Job`，持久化于 Redis，`process()` 消费 |
| Redis 锁 `acquireLockKv` 防重入 | 只能防并发，不能排队/重试 | `defaultJobOptions` + 固定 `jobId` 幂等 + `distributedLock` + `concurrency=1` |
| `getMeiliProgress` / `getProgress` 写 `siteConfig` | 自建状态，无失败语义 | `job.updateProgress()` + 自建 job 日志表（见 §6） |
| croner 硬编码定时 | 无法错峰/编排 | `scheduleCron()` + `repeat.cron` + `dependsOn` |
| `cloudreveSyncScript` 末尾 `void syncDelta()` | 隐式链式调用，失败不可见 | 队列内显式 `queue.add({ type:'delta' })` |

---

## 2. 架构与模块划分

### 2.1 目录结构

```
apps/api/src/
├── libs/
│   └── queue/
│       ├── index.ts          # 薄封装：QueueFactory、队列单例枚举、类型导出
│       ├── config.ts         # Redis client 注入（复用 getRedisClient()）+ 默认 JobOptions + 前缀
│       └── types.ts          # 各任务 payload 类型（TaskPayload 联合）
├── db/
│   └── schema/
│       └── task-log.ts       # galrc_queue_job / galrc_queue_job_log（见 §6）
├── modules/
│   └── tasks/                # 新模块（对齐现有三文件结构）
│       ├── index.ts          # Elysia 路由：手动入队 + 状态查询 + 进度/日志查询
│       ├── model.ts          # TypeBox schema（入队请求、进度查询、日志查询）
│       └── service.ts        # 队列定义 + Worker 注册 + handler（薄壳调用现有 CronService/VndbSync）
```

**不重写业务逻辑**：现有的 `CronService.cloudreveSyncScript`、`meiliSearchAddIndex` 等，以及 `VndbSync.syncFull/syncDelta/syncProducersFromDb` 的**核心实现全部复用**，只把「触发」和「进度上报」两处从内部挪到 Worker 层。这是最小侵入的迁移策略。

### 2.2 队列划分（4 个队列）

| 队列名 | `name` | 消费的 job 类型 | concurrency | 备注 |
|--------|--------|----------------|-------------|------|
| `vndb-sync` | `galzy:vndb-sync` | full / delta / producers | **1** | VNDB API 限流，且全量/增量互斥 |
| `meili-index` | `galzy:meili-index` | game / tag / producer | 3 | **滚动模式下按类型隔离，允许并行**；详见 §4 |
| `cloudreve-sync` | `galzy:cloudreve-sync` | sync | 1 | 已有分布式锁语义，队列串行天然替代 |
| `metrics` | `galzy:metrics` | workerDataPull | 1 | 每分钟的 CF 指标拉取 |

> 说明：`cloudreveSyncScript` 末尾原来会 `void VndbSync.syncDelta()`——迁移后改为 Worker handler 完成 cloudreve 同步后**显式 `await vndbQueue.add({ type:'delta' })`**，保留「同步成功后紧跟一次增量」的现状行为，但失败可捕获、可观测。

### 2.3 Redis 连接注入（核心诉求）

```ts
// libs/queue/config.ts
import { getRedisClient } from '@api/libs/redis'
import type { QueueConnectionConfig } from '@stacksjs/bun-queue'

export function queueConnection(overrides?: Partial<QueueConnectionConfig>): QueueConnectionConfig {
  return {
    driver: 'redis',
    redis: { client: getRedisClient() }, // ← 复用现有 Bun redis 实例
    prefix: 'galzy-queue',               // ← 决策 3：与项目 kv 的 galzy:* 同源但独立前缀
    ...overrides,
  }
}
```

- 现有的 `kv.ts` 缓存/锁**完全不动**，两类 key 前缀隔离（`galzy:*` vs `galzy-queue:*`）。
- **生产环境**（`isRedisEnabled===true`）注入真实 client，队列/Worker/scheduleCron 全量启用。
- **开发环境**（决策 1）：`NODE_ENV !== 'production'` 且无 Redis 时，**`startQueueWorkers()` 直接不调用**，同时 croner 也不启动。手动触发接口在 dev 下降级为「同步执行并返回结果」（保留本地可调试性），但不走队列、不占用 Redis。

### 2.4 双环境行为（决策 1 落地）

| 环境 | Redis | 队列 Worker | croner | 手动触发 |
|------|-------|------------|--------|---------|
| production | 有 | ✅ 启动 | ❌（已移除） | 入队，返回 jobId |
| production（Redis 短暂不可用） | 无 | Worker 启动失败→依赖 `safeRedisOp` 语义跳过并告警 | — | 入队失败→返回 503 |
| development | 无 | ❌ 不启动 | ❌ 不启动 | **进程内联执行**（fire-and-forget，见 §11），便于调试 |

> ⚠️ 上表的「development」行不能理解为「Redis 一定是关的」。本仓库 `apps/api/.env` 本地就是
> `REDIS_ENABLED=true` + 生产 `REDIS_URL`，而 Worker 只在 `NODE_ENV=production` 启动 —— 见 §11。

---

## 3. Worker 运行形态与启动点

**决策：同进程内嵌 Worker**（与 Dokploy 单服务形态一致）。

在 `apps/api/src/index.ts` 的 `startServer()` 里，`dbReady` 之后、`listen` 之前：

```ts
const dbReady = await dbAction()
if (process.env.NODE_ENV === 'production' && dbReady) {
  startQueueWorkers()   // ← 替代原 startCronTasks()：4 个 Worker + scheduleCron 注册
  startDbWatchdog()
}
```

- `startQueueWorkers()` 内部做三件事：① 用 `getRedisClient()` 建队列单例；② 为每个队列注册 `process(concurrency, handler)`；③ 用 `scheduleCron` 注册 workerDataPull(1min)/cloudreve(30min)/meili(每周日 3:00)。
- Worker 在 API 进程内存活；未来横向扩容用 bun-queue 的 `horizontalScaling` + `leaderElection`（本期不配置）。

---

## 4. Meilisearch 滚动重建（决策 2，核心变更）

**背景**：现状 `meiliSearchAddIndex` / `meiliSearchAddTag` / `meiliSearchAddProducer` 都是「`deleteAllDocuments()` → 分页 `addDocuments` 全量重写」。在重建期间索引为空，用户搜索会短暂返回空结果。

**目标**：改为**滚动增量**——不清空索引、不回退，用 `updateDocuments`（存在则更新、不存在则新增）逐页滚动，全程保留旧文档可被搜索，最后再清理「已不在数据库中的过期文档」。

### 4.1 滚动策略（三阶段）

对每个索引（game / tag / producer）：

1. **扫描阶段**：读取该领域在 DB 中的全部分页数据，逐页 `updateDocuments(docs, { primaryKey })`——只更新/新增，**不删任何文档**。过程中用户搜到的始终是「旧的仍在、新的逐渐进来」。
2. **一致性阶段**（可选，滚动末尾）：对已写入的文档做一次 `updateSettings`（filterable/sortable/searchable/pagination），与现状 `meiliSearchAddIndex` 末尾的 settings 更新等价。
3. **清理阶段**：清理「DB 中已不存在、但索引里仍残留」的过期文档。Meilisearch v0.44 用 `deleteDocuments` + 反查（拿索引里的 ID 集合与 DB 现存 ID 集合做差集），只删差集，**不碰仍在库里的文档**。

> 这是与「清空重建」语义等价但零空窗的做法。代价是「删」的动作后置——若清理阶段失败，最多残留过期文档（可搜到但已下架），**不会出现空结果**，安全性更高。

### 4.2 进度与粒度

- 用 `job.updateProgress(processed/total)` 上报滚动进度（沿用现有 `totalPages/processedPages` 语义）。
- meili 三类型（game/tag/producer）**互不影响**，可在 `meili-index` 队列内 `concurrency=3` 并行；同一类型内部仍逐页串行（避免同类型写冲突）。

### 4.3 对现有代码的改造点

- `meiliSearchAddIndex` 删除 `deleteAllDocuments()` 调用，改为 `updateDocuments` 滚动 + 末尾差集删除。
- 三处 `indexPageWithRetry`/`indexTagPageWithRetry`/`indexProducerPageWithRetry` 的页级 `retries=3` 收敛到队列层 `attempts`（见决策 2 配套：**页级重试删除，改 job 级重试**——因为滚动模式下单页失败重试是安全的，不影响已完成页）。

---

## 5. 任务日志与进度查看（决策 5，新增）

**事实依据**：bun-queue 的 `Job` 类只有 `updateProgress(number)`，**没有任务级 logs 数组、没有 `updateLog`/`addLog` API**；`Logger` 仅 console 级。因此任务日志**必须自建存储**。

### 5.1 自建 job 日志表（PostgreSQL + Drizzle）

新增两张表（`db/schema/task-log.ts`），复用 Drizzle ORM（决策：不用 bun-queue 的 `QueueManager` `failed.driver:'database'`，因其对日志粒度/查询的掌控不足，且我们要的是「执行日志 + 进度 + 状态」统一视图）：

```ts
// galrc_queue_job —— 一次任务执行的生命周期（对应一个 queue job）
export const queueJob = pgTable('galrc_queue_job', {
  id: varchar('id', { length: 255 }).primaryKey(),   // = bun-queue job.id
  queue: varchar('queue', { length: 64 }).notNull(),  // vndb-sync | meili-index | cloudreve-sync | metrics
  type: varchar('type', { length: 64 }).notNull(),    // full | delta | producers | game | tag | producer | sync | workerDataPull
  status: varchar('status', { length: 16 }).notNull(),// queued | running | completed | failed | dead-letter
  progress: integer('progress').notNull().default(0), // 0-100（或按任务自定义口径）
  payload: jsonb('payload'),                          // 入队参数快照
  result: jsonb('result'),                            // 完成时的 returnvalue
  error: text('error'),                               // 失败原因
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// galrc_queue_job_log —— 任务执行日志（每行一条，可流式追加）
export const queueJobLog = pgTable('galrc_queue_job_log', {
  id: serial('id').primaryKey(),
  jobId: varchar('job_id', { length: 255 }).notNull(), // 外键 → queueJob.id
  level: varchar('level', { length: 8 }).notNull(),    // info | error | success | warn
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

### 5.2 日志写入链路

Worker handler 注入一个 `logger`（薄封装），内部实现：

- `logger.info/warn/error/success(message)` → 写 `galrc_queue_job_log`（每次 `db.insert`，天然持久化、可按时间流式查看）。
- `logger.progress(n)` → 同时做两件事：`job.updateProgress(n)`（写 Redis，供 bun-queue 语义）+ `update galrc_queue_job.progress`（落库，供查询接口离线读取）。
- 生命周期钩子：`add()` 时写 `galrc_queue_job(status='queued')`；Worker 开始 `running`；结束 `completed/failed` + `result/error`；进入 DLQ 写 `dead-letter`。

> 替换对象：现状 `CronService.updateMeiliProgress/addMeiliLog` 与 `VndbSync.updateProgress/addLog` 写的 `siteConfig` 进度——迁移后改由 `queueJob`/`queueJobLog` 承载，`siteConfig` 里的 `meiliSearchProgress_*`、`vndbSyncProgress` 逐步废弃（`cloudreveSyncTime` 因是对外统计接口的数据源而**保留**）。

### 5.4 日志 TTL（决策 3 落地）

日志存储于 PostgreSQL，**不能用 Redis 的 `EXPIRE`**，由一条定时清理任务按 `createdAt` 物理删除过期行：

| 表 | 默认保留期 | 删除方式 |
|----|-----------|---------|
| `galrc_queue_job_log` | **14 天** | `DELETE ... WHERE created_at < now() - interval '14 days'`（按 jobId 或批次删除） |
| `galrc_queue_job` | **90 天**（保留最近任务历史供回溯） | 同上，但需**先删其子日志或级联删** |

- 清理任务挂在一个低频 `scheduleCron`（如每天凌晨 4:00），或并入现有 `metrics` 队列的一个独立 job 类型 `queueLogPrune`。
- 保留期走环境变量 `QUEUE_LOG_TTL_DAYS`（默认 14）与 `QUEUE_JOB_RETENTION_DAYS`（默认 90），便于运维调整而不改代码。
- 删除采用**分批 `DELETE`**（如每批 1000 行 + `createdAt` 索引），避免大表一次性长事务锁表；`queueJobLog` 建 `(jobId, createdAt)` 索引、`queueJob` 建 `(createdAt)` 索引支撑清理与查询。
- 由于有 TTL，`queueJobLog` 无需无损归档，过期即物理删。

### 5.3 查询接口（`modules/tasks`）

| 路由 | 返回 | 对应现状 |
|------|------|---------|
| `GET /tasks` | 最近的 job 列表（分页、按 queue/type/status 过滤） | 无（新增） |
| `GET /tasks/:jobId` | job 详情：状态、进度、payload、result、error | 替代 `getMeiliProgress`/`getProgress` |
| `GET /tasks/:jobId/logs` | 该 job 的日志（按时间正序，分页/游标） | 替代 `addMeiliLog` 写入的日志 |
| `POST /tasks/:queue` | 手动入队（现有 GET 触发点迁移到此，POST 语义更正确） | 替代 `/task/*`、`/vndb-sync/*` 触发 |
| `GET /tasks/queues` | 各队列实时状态（waiting/active/completed/failed 计数） | 基于 `queue.getJobCounts()` |

**兼容性**：现有 `/vndb-sync/progress`、`/task/meiliSearchProgress` 等查询接口先保留为「从 `queueJob` 表聚合」的兼容层，返回结构不变，前端管理页零破坏，后续可平滑切换到 `/tasks/*`。

---

## 6. 迁移阶段（分步、可回滚）

### 阶段 A：基础设施 + 旁路
1. `bun add @stacksjs/bun-queue`（锁 `0.1.8`）。
2. 新增 `libs/queue/*`（连接注入 + 默认 JobOptions + payload 类型 + 前缀 `galzy-queue`）。
3. 新增 `db/schema/task-log.ts` + 迁移（`db:generate` → `db:up` → `db:check`，遵守项目迁移规则）。
4. 新增 `modules/tasks/*` 空壳路由（`GET /tasks/queues` 只读队列状态，不接任何现有触发逻辑）。

### 阶段 B：迁入一个最小任务验证（meili game 重建 + 滚动改造）
5. 把 `meiliSearchAddIndex` 改为**滚动增量**（§4）——此步骤与队列解耦，可先单独上线验证滚动无空窗。
6. 编写 `tasks/service.ts` 的 meili game handler（薄壳调用改造后的 `CronService`，进度改 `job.updateProgress` + 日志落 `queueJobLog`）。
7. `.get('/task/meiliSearchAddIndex')` 改为 `meiliQueue.add({ type:'game' })` 并返回 jobId。
8. 观察 1~2 次周重建，确认滚动无空窗、日志/进度正常。

### 阶段 C：迁入其余任务
9. meili tag / producer → 同 game（滚动 + 入队）。
10. cloudreve sync + workerDataPull → `scheduleCron` 替换 croner；手动触发改入队。
11. vndb full/delta/producers → 手动入队；`cloudreveSyncScript` 末尾 `void syncDelta()` 改为显式 `await vndbQueue.add({ type:'delta' })`。
12. 移除 `startCronTasks()` 与 croner 依赖（决策 4：不保留兜底）。

### 阶段 D：清理
13. ~~删除 `indexPageWithRetry` / `indexTagPageWithRetry` / `indexProducerPageWithRetry`~~ **保留**：滚动模式下页级重试（细粒度）优于 job 级整体重跑（会重放全部文档），两者并存不冲突。
14. ~~精简 `galzy:lock:cron:*` 锁~~ **保留**：锁是无害冗余（多一层防重入，多实例部署仍需要），与队列 `concurrency=1` 叠加更稳。
15. `siteConfig` 进度键（`meiliSearchProgress_*`、`vndbSyncProgress`）**暂保留**为过渡兼容层（`/task/meiliSearchProgress`、`/vndb-sync/progress` 查询接口仍依赖）；新数据源是 `queueJob`/`queueJobLog`，前端切换到 `/tasks/*` 后再废弃旧键。
16. **移除 croner 依赖**（`apps/api/package.json` 的 `croner`，已删）+ 更新 `.env.example` 与部署文档（`QUEUE_LOG_TTL_DAYS`/`QUEUE_JOB_RETENTION_DAYS`）。

---

## 8. 落地状态（2025-01 完成）

阶段 A/B/C/D 均已落地，编译通过（biome 全绿；typecheck 仅剩 4 个 pre-existing 的 `games/service.ts` 事务类型错误，与本次无关）。

| 阶段 | 内容 | 状态 |
|------|------|------|
| A | `libs/queue/*` + `db/schema/task-log.ts` + 迁移 `0012_bent_chimera.sql` + `modules/tasks/*` | ✅ |
| B | meili 三索引滚动改造 + `runMeiliHandler` + 触发点入队 + dev 降级 | ✅ |
| C | vndb/cloudreve/metrics handler + `scheduleCron` 定时 + `queue-log-prune` TTL 清理 + vndb-sync 触发点入队 | ✅ |
| D | 移除 `startCronTasks` + croner 依赖 | ✅ |

**待办（上线前必须处理）：**
- [ ] `bun --cwd apps/api db:up` 应用迁移 `0012`（当前未执行，留待部署）。
- [ ] 生产环境验证 `scheduleCron` 定时与 Worker 消费（需真实 Redis + Meili + VNDB API）。
- [ ] 前端管理页切换到 `/tasks/*` 状态/日志接口后，再废弃旧 `siteConfig` 进度键。

---

## 9. 交付物清单（已实施）

| 议题 | 定案 |
|------|------|
| 滚动清理反查 | 保守策略：每周清理一次，失败只残留不误删（`deleteDocuments` 只删 DB 不存在的差集） |
| 进度口径 | 统一百分比 0–100（`job.updateProgress`）；绝对数（`processedItems/totalItems` 等）存入 `queueJob.result` |
| 日志 TTL | `queueJobLog` 保留 14 天、`queueJob` 保留 90 天，定时分批物理删除，走 `QUEUE_LOG_TTL_DAYS`/`QUEUE_JOB_RETENTION_DAYS` 环境变量 |

---

## 8. 交付物清单（审批通过后实施）

- [ ] `apps/api/src/libs/queue/config.ts` —— Redis client 注入 + 默认 JobOptions + 前缀 `galzy-queue`
- [ ] `apps/api/src/libs/queue/types.ts` —— `TaskPayload` 联合类型
- [ ] `apps/api/src/libs/queue/index.ts` —— `QueueFactory` 薄封装 + 队列实例单例
- [ ] `apps/api/src/db/schema/task-log.ts` —— `queueJob` / `queueJobLog` 表
- [ ] `apps/api/drizzle/` 迁移 SQL（`db:generate` 生成）
- [ ] `apps/api/src/modules/tasks/{index,model,service}.ts` —— 路由 + schema + Worker 注册/handler + logger
- [ ] `apps/api/src/index.ts` —— `startQueueWorkers()` 挂载点（替代 `startCronTasks()`）
- [ ] `apps/api/src/modules/cron/index.ts` —— meili 滚动改造 + 触发点改造
- [ ] `apps/api/src/modules/vndb-sync/index.ts` —— 触发点改造
- [ ] `apps/api/.env.example` —— 队列相关环境变量（如需）
- [ ] 移除 croner 依赖与 `startCronTasks`

---

## 10. 列表查询契约 V2（2026-10 落地）

任务管理页重构（见 `docs/admin-task-list-refactor.md`）把 `GET /tasks` 从「3 个单值等值 + 固定排序」升级为可筛选/可排序/带分面的查询。本节记录**已落地**的契约，旧参数语义全部保留。

### 10.1 `GET /tasks`

| 参数 | 说明 |
|---|---|
| `q` | 关键字（`id` / `type` / `error` 子串，LIKE 通配符已转义） |
| `status` / `statuses` | 单值 + 多值（并集），非法值 400 `INVALID_FILTER` |
| `queue` / `queues` | 同上，队列名以 `QUEUE` 常量为白名单 |
| `type` / `types` | 同上，类型以 `QUEUE_TASKS` 为白名单 |
| `dateFrom` / `dateTo` | `created_at` 半开区间 |
| `overdue` | 非终态且超过 SLA（queued: 创建 + 10min；running: 开始 + 该类型 SLA） |
| `retryable` | 等价于 `status ∈ failed/dead-letter/interrupted` |
| `sort` / `order` | 白名单 `createdAt/startedAt/finishedAt/status/type` + `asc/desc`，带 `id` 稳定二级键 |
| `page` / `pageIndex` / `pageSize` | 1 基优先；pageSize ≤ 100 |
| `withCounts` | 是否返回分面 `counts`（轮询可关，省一次聚合） |

响应：`{ items, total, page, pageIndex, pageSize, totalPages, counts?, applied }`。
**counts 口径**：where 不含状态、total 含状态 ⇒ 点任意状态后 `total === counts[status]`。

### 10.2 写操作（门控 + 幂等）

| 路由 | 语义 |
|---|---|
| `POST /tasks/:jobId/delete` | 非终态 409 `TASK_NOT_TERMINAL`；body `{ force?: true }` 才允许（先 removeJob 再删记录） |
| `POST /tasks/batchDelete` | 逐项判定：终态删除、非终态进 `failed`、不存在进 `missing`；日志与任务同事务 |
| `POST /tasks/:jobId/retry` | 死信走 DLQ 重放（`mode=republish`）；其余新 jobId（`mode=requeue`）；同 queue+type 有活跃任务 409 `TASK_ALREADY_ACTIVE` |
| `POST /tasks/batchRetry` | 逐项独立结果，部分失败不整体回滚 |
| `POST /tasks/deadLetter/:queue/{republish,remove,batchRepublish,batchRemove}` | 幂等：已不存在计 `missing`，不整体 404 |

错误体统一 `{ code, message }`；BFF（`apps/web/src/server/admin/tasks.ts`）把 code 编码进 message（`CODE|message`）以穿过 server fn 的跨进程边界。

### 10.3 迁移

- `0026_nasty_the_twelve.sql`：6 条组合/排序索引（`db:generate` 生成）
- `0027_queue_job_search_indexes.sql`：`id/type/error` 的 `pg_trgm` GIN（手写，参照 0009/0023）
- 应用方式不变：`bun --cwd apps/api db:up`

---

## 11. 无 Worker 进程的内联执行（2026-11 落地）

**问题（线上真实发生）**：本地 `apps/api/.env` 里 `REDIS_ENABLED=true` 且 `REDIS_URL` 指向**共享生产 Redis**，
而 Worker 只在 `NODE_ENV=production` 启动（`apps/api/src/index.ts:119`）。于是本机点「同步」按钮会真的入队，
被线上**旧镜像**的 Worker 领走 → 它不认识新加的任务类型 → `未知的 kungal 任务类型: kungal-characters` →
重试耗尽进 dead-letter。用户侧表现是「点了没反应」，队列里却堆着一串永远跑不完的旧任务。

原 `enqueue()` 只对「Redis 整个不可用」(`!isQueueEnabled`) 做降级，且仅 `meili-` 类型降级为同步执行；
「Redis 可用、但本进程没有消费方」这一档完全没有覆盖 —— 这正是本机 dev 的形态。

### 11.1 决策：按「有没有消费方」分三条路，而不是按「Redis 是否可用」

| 条件 | 路径 | 返回 |
|---|---|---|
| `isWorkerRunning()`（本进程起了 Worker，生产唯一路径） | 正常入队 | `queue.add()` 的 jobId |
| 无 Worker 且 `NODE_ENV !== production` | **进程内联执行** | `inline:<type>:<ts>`，立刻返回 |
| 生产且队列不可用 | 抛错（保持原语义） | — |

- `isWorkerRunning()` 是模块级标志，只有 `startQueueWorkers()` 注册完全部 Worker 后才置 `true`。
  判定放在 `enqueue` 入口，所以**生产路径行为完全不变**：生产一定有 Worker，一定走队列。
- 内联路径**只对非生产开放**。生产即使 Redis 短暂不可用导致 Worker 没起来，也仍然报「队列不可用」，
  不能悄悄改成同步跑全量同步 —— 那会把 HTTP 请求拖死（kungal/vndb 全量要几十分钟）。

### 11.2 内联执行的行为契约

- **fire-and-forget**：立刻返回 jobId，handler 在后台 `void` 跑。全量同步动辄几十分钟，HTTP 等不起（Eden 会先超时）。
- **照常落 PG**：`galrc_queue_job` 走 queued → running(+startedAt) → completed/failed，并写 `galrc_queue_job_log`，
  管理端「任务」页能看到这一条，不必为本地开发单独做一套视图。
- **jobId 前缀 `inline:`**：与 bun-queue 的雪花 id 不冲突，也不占用 `cron:` 前缀（对账逻辑据 `cron:` 跳过 repeatable job）。
  凡是按 jobId 摸 Redis 的地方（`detachFromQueue`、启动对账）都要跳过它。
- **同 type 去重**：进程内 `Map<type, jobId>` 记录在跑的内联任务，重复触发直接返回已有 jobId，
  避免连点起两个全量同步（原来靠队列串行 + `TASK_ALREADY_ACTIVE`，内联路径没有队列来兜）。
- **失败必须自己写终态**：内联路径没有 bun-queue 的 `jobCompleted` / `jobMovedToDeadLetter` 事件，
  不显式 `markFailed` 行就会永远停在 running —— 这与生产上那条 `status=queued` 僵尸行是同一成因。

### 11.3 影响与代价

| 项 | 影响 |
|---|---|
| 生产 | **零影响**：仍有 Worker，`canRunInline()` 恒 false |
| 本机 dev | 任务不再进共享生产队列，不再被线上旧镜像 Worker 领走；结果只写本地连的那个库 |
| 进程退出 | 未跑完的内联任务会中断，行停在 running；由启动对账标 interrupted，与队列任务口径一致 |
| 并发保护 | 仅覆盖「同进程同 type」；起两个 API 进程各自内联同一 type 不会互斥（本地开发可接受） |
| 删除任务 | `detachFromQueue` 对内联 jobId 直接 return，不去 Redis 白跑一次 `removeJob` |

### 11.4 配套：终态兜底与启动对账

僵尸行的**真正成因**（bun-queue 0.1.8 `dist` 里 `moveToFailed` 之后的决策链）：

```js
await job.moveToFailed(err)                       // 一定写 finishedOn + failedReason
if (dlqEnabled && job.attemptsMade >= dlqMax)     // ① 进死信
  return queue.moveToDeadLetter(job.id, …)        //    发 jobMovedToDeadLetter
if (job.attemptsMade < maxAttempts)               // ② 重试（放 delayed 或 retry）
  return /* delayed / retry */
// ③ 两档都不满足：不重试、不进 DLQ、**也不发任何事件**，job 静静躺在 failed 列表
```

第 ③ 档是致命的：`resetRetries` 的死信重放会把 `attempts` 置 0，而库内部按 `opts.attempts || 1`
处理，于是第二次失败就落进这一档 —— 生产库里的 `mw2cbfguibyno98h28` 正因此停在 `status=queued`、
`started_at` 有值、`finished_at=null`（Redis 侧 `failedReason` 是「未知的 kungal 任务类型: kungal-characters」）。

对策三条，缺一不可：

1. **Worker 三档齐写**（`createWorker` 的 catch）：`willDeadLetter` → `markDeadLetter`；
   `willRetry` → 只记日志（终态留给后续尝试）；**两档皆否 → `markFailed`**。
   判定必须逐条复刻库的逻辑，注意两个易错点：`maxAttempts = opts.attempts || 1`（**是 `||` 不是 `??`**）、
   `dlqEnabled` 要先看单 job 的 `opts.deadLetter` 再看队列默认值。
   事件随后再来写同值，幂等无害。
2. **queued 僵尸对账**：`reconcileQueuedZombies()` 扫 `status=queued`（按 `created_at` 升序、单轮上限 500，
   每行一次 Redis 往返，不设上限会把启动拖成分钟级），分三种结局：
   - `getJob` 返回 `null` → 标 `interrupted`（记录在队列里已不存在）；
   - job 已终结（`finishedOn` 有值**且** `attemptsMade` 已耗尽重试或够 DLQ 阈值）→ 按 Redis 真实结果补写
     `failed` / `dead-letter` / `completed`，失败原因带上库里的 `failedReason`；
   - 其余（还在 wait/active/delayed）→ 不动。
   两个必须注意的判定细节：① 该队列 `ping()` 成功才查 —— bun-queue 的 `getJob` 内部吞异常返回 `null`，
   不先 ping 会把 Redis 抖动误判成「job 不存在」；② **不能只看 `finishedOn`** —— `moveToFailed` 无论
   后面重不重试都会写它，光凭它会误伤正在 delayed 等下一轮重试的任务；
   ③ 是否进过 DLQ 要查 DLQ 自己的 key（`<prefix>:<queue>-dead-letter:<id>`），因为 bun-queue 只把 job
   移出 `failed` 列表、原 job key 仍在。标错会让管理端的「重放」按钮消失。
3. **上个进程的内联行**：`inline:` 行不在 Redis 里，但走到对账就说明「本进程有 Worker」（对账只由
   `startQueueWorkers` 触发）而内联执行只发生在没有 Worker 的进程 —— 两者不可能同时成立，所以这些
   一定是上个进程的遗留（本地 dev 连的就是生产库），单独标 `interrupted` 并给出如实的错误文案。

`cron:` 前缀的行直接跳过：repeatable job 的实体在 scheduler zset 里、没有普通 job key，按「查不到」判定必然误伤。
整步失败只告警，不拦启动（对账不是关键路径）。

### 11.5 配套：分派表统一

原来的 `runMeiliHandler` / `runVndbHandler` / `runKungalHandler` / `runCloudreveHandler` 各自 `switch` + `default throw`，
与 `QUEUE_TASKS` 白名单是**两份并行真相**：白名单新增类型时漏写 case 照样编译通过，运行时才炸成
`未知的 xxx 任务类型`（生产上真出过一次 dead-letter）。现在合并为单一 `TASK_HANDLERS`，
用 `satisfies Record<TaskPayload["type"], TaskHandler>` 让类型系统兜住穷尽性。

运行时仍保留一层兜底（payload 来自 Redis/DB，可能是旧镜像写入的历史类型），错误文案经
`taskFamilyOf()` 还原成 `未知的 <族> 任务类型: <type>` —— 这四条串是线上日志的检索锚点，合并后不能丢。

