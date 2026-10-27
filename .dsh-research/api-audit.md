# 任务队列 API 审计与契约 V2

> 审计范围：`apps/api/src/modules/tasks/*`、`apps/api/src/db/schema/task-log.ts`、`apps/api/src/libs/queue/*`、`apps/web-tanstack/src/server/admin/tasks.ts`、`apps/web-tanstack/src/components/admin/tasks-page.tsx`、`docs/task-queue-migration.md`。
> 方式：只读取证，**未修改任何源码**。所有结论附 `文件:行号`。
> 状态：审计时点 2026-10-27，基于当前工作区未提交状态。

---

## 0. 结论摘要（先看这里）

1. **`GET /tasks` 的过滤能力只有 3 个单值等值 + 1 个固定排序**：`queue` / `type` / `status`，均为 `eq`，排序硬编码 `created_at DESC`（`apps/api/src/modules/tasks/service.ts:344-371`）。
2. **`type` 是「死能力」**：后端 model + service 都支持（`model.ts:27`、`service.ts:353`），BFF 也透传（`server/admin/tasks.ts:64`），但**页面从未传**（`tasks-page.tsx:856`、`:873-880`，路由预取 `_authL/tasks.tsx:15-17` 也未传）。
3. **不存在「统计 500 条上限」**。`getTaskStats` 是全表 `GROUP BY status`（`service.ts:374-397`），无 limit、无时间窗。唯一的 500 是**日志** `pageSize` 的 `maximum: 500`（`model.ts:35`）与 BFF 的 `z.maximum(500)`（`server/admin/tasks.ts:151`、`:194`）。前端 KPI 文案「最近 500 条」（`tasks-page.tsx:1280`）与真实口径不符 —— 那是全表行数（受 90 天保留期约束）。
4. **统计与筛选完全脱钩**：Tabs 徽标 / KPI 用的是全局 counts（`tasks-page.tsx:1304-1317`、`:1253-1281`），而下表是过滤后的分页；因此「失败 12」与点进失败 Tab 后的 `total` 可能不一致（`queue` 筛选时尤其明显）。
5. **写操作语义有三处硬伤**：`retry` 非幂等（每次生成新 jobId，重复点会重复跑重任务，`service.ts:340`）；死信重放/丢弃二次调用返回 404 而非幂等成功（`service.ts:239-242`、`:255-256`）；`deleteJob`/`batchDeleteJobs` 的两次 DELETE 无事务（`service.ts:281-282`、`:306-310`），且 `batchDelete` 只限 minItems、无 maxItems（`model.ts:21`）。
6. **索引只有 4 条单列 btree**（`task-log.ts:40-44` / `drizzle/0012_bent_chimera.sql:23-26`），足以支撑「单条件 + created_at 排序」，但**排序白名单一旦放开 startedAt/finishedAt/status/type 就会退化成 Seq/bitmap + Sort**；关键字搜索（`q`）没有任何索引支撑。
7. **列表把重字段全量返回**：`db.select().from(queueJob)`（`service.ts:361`）每行带 `payload`/`result` 两个 jsonb，前端表格只用 8 个标量列（`tasks-page.tsx:1024-1100`）；V2 必须做投影下沉。
8. 契约 V2 设计为「**纯增量 + 仅死信列表一处破坏性变更（同 PR 收口）**」，见 §8。

---

## 1. 现状路由清单（证据：`modules/tasks/index.ts`）

| 方法 | 路径 | 处理函数 | 校验 | 权限 | 证据 |
|---|---|---|---|---|---|
| GET | `/tasks/stats` | `getTaskStats()` | 无入参 | `isAdmin` | `:32` |
| GET | `/tasks/queues` | `getQueueStats()` | 无入参 | `isAdmin` | `:33` |
| GET | `/tasks/deadLetter/:queue` | `listDeadLetterJobs` | `queueParam` + `logsQuery` | `isAdmin` | `:35-44` |
| POST | `/tasks/deadLetter/:queue/republish` | `republishDeadLetterJob` | `deadLetterJobBody` | `isAdmin` | `:45-54` |
| POST | `/tasks/deadLetter/:queue/remove` | `removeDeadLetterJob` | `deadLetterJobBody` | `isAdmin` | `:55-64` |
| GET | `/tasks/` | `listJobs(query)` | `listQuery` | `isAdmin` | `:66-69` |
| GET | `/tasks/:jobId` | `getJobDetail` | 无 | `isAdmin` | `:70-72` |
| GET | `/tasks/:jobId/logs` | `getJobLogs` | `logsQuery` | `isAdmin` | `:73-78` |
| POST | `/tasks/enqueue/:queue` | `enqueue` | `enqueueBody` | `isAdmin` | `:79-91` |
| POST | `/tasks/batchDelete` | `batchDeleteJobs` | `batchDeleteBody` | `isAdmin` | `:92-95` |
| POST | `/tasks/:jobId/retry` | `retryJob` | 无 | `isAdmin` | `:96-98` |
| POST | `/tasks/:jobId/delete` | `deleteJob` | 无 | `isAdmin` | `:99-101` |

路由顺序说明：静态段 `/stats`、`/queues`、`/deadLetter/:queue` 注册在动态段 `/:jobId` 之前，靠「先注册先匹配」避免被影子化（源码注释 `:25-27`、`:34`）。V2 新增静态路径必须同样放在 `/:jobId` 之前。

路径写法说明：源码注册为 `.get('/')`（`index.ts:66`），拼接 prefix 后为 `/tasks/`；仓库内既有调用统一走 Eden `api.tasks.get({ query })`（`server/admin/tasks.ts:71-74`，返回 `{ items, total }` 与 `service.ts:370` 一致），说明该挂载可用。**契约文档统一写作 `GET /tasks`**，实现时保持原样即可，不要在 V2 里改成 `.get('')`。

---

## 2. `GET /tasks` 真实能力（listJobs 逐行解读）

```ts
// apps/api/src/modules/tasks/service.ts:344-371
const conditions = [
  input.queue  ? eq(queueJob.queue,  input.queue)  : undefined,   // :352
  input.type   ? eq(queueJob.type,   input.type)   : undefined,   // :353
  input.status ? eq(queueJob.status, input.status) : undefined,   // :354
].filter(...)                                                    // :355
const where = conditions.length ? and(...conditions) : undefined  // :357
// 并行：列表 + 精确 count
db.select().from(queueJob).where(where)
  .orderBy(desc(queueJob.createdAt))                              // :364  ← 唯一排序
  .limit(pageSize).offset(pageIndex * pageSize)                   // :365-366
db.select({ count: count() }).from(queueJob).where(where)          // :367
return { items: rows, total: totalRow[0]?.count ?? 0 }             // :370
```

### 2.1 过滤

| 能力 | 支持 | 证据 | 说明 |
|---|---|---|---|
| 单队列 `queue` | ✅ | `service.ts:352`、`model.ts:26` | 等值 |
| 单类型 `type` | ✅（后端） | `service.ts:353`、`model.ts:27` | 前端未使用，见 §2.4 |
| 单状态 `status` | ✅ | `service.ts:354`、`model.ts:28` | 等值，无法多选 |
| 多状态 `status[]` | ❌ | 同上 | 需点 6 次 Tab |
| 关键字 `q` | ❌ | 无 | 现状由前端在本页内过滤 |
| 时间范围 | ❌ | 无 | 无 `createdAt`/`startedAt` 区间 |
| 队列多选 `queue[]` | ❌ | 无 | |
| 排序 | ❌（固定） | `service.ts:364` | 仅 `created_at DESC` |
| 每页 100 上限 | ✅ | `model.ts:29` | `maximum: 100` |

**空串陷阱**：`model.ts:26-28` 全是 `t.Optional(t.String())`，没有 `minLength`，`?status=` 会以空串进入 `eq(...)` 从而返回 0 行（前端用 `status || undefined` 规避，`tasks-page.tsx:877-878`，但这属于前端兜底，不是契约保证）。

### 2.2 排序

硬编码 `desc(queueJob.createdAt)`（`service.ts:364`）。没有任何 `sort`/`order` 入参。**且没有稳定的二级排序键**：同一毫秒内创建的多条记录（批量入队、cloudreve 链式入队 `service.ts:846-856`）在分页时可能重复或漏行。

### 2.3 分页与 total

- 0 基 `pageIndex` + `pageSize`（`model.ts:29-30`），`offset = pageIndex * pageSize`（`service.ts:366`）。
- `total` 用同 where 的 `count()` 精确统计（`service.ts:367`），每次翻页都多一次全条件 count。
- 越界页不校验：`pageIndex` 超出末页返回空数组 + 真实 total，前端 `pageCount = Math.max(1, ceil(total/pageSize))`（`tasks-page.tsx:890`）会自行纠偏但**不会自动回跳**，出现「空表格 + 页码 99」的僵死态。
- 响应只有 `{ items, total }`（`service.ts:370`），**不回显 page/pageSize**，前端只能自己记（`tasks-page.tsx:844`）。

### 2.4 前端筛选项 × 后端能力对照（关键表）

| 前端可见能力 | 位置 | 后端支持？ | 实际行为 |
|---|---|---|---|
| 状态 Tabs（7 个） | `tasks-page.tsx:154-162`、`:1296-1319` | 单值 ✅ | 传 `status`，可用；徽标数字是**全局** counts |
| 队列下拉 | `tasks-page.tsx:1359-1370` | ✅ | 传 `queue` |
| 搜索框 | `tasks-page.tsx:1352-1358` | ❌ | 仅过滤**当前页 20 条**（`:988-997`），placeholder 也写明「在本页搜索」（`:1356`） |
| 任务类型 | 无 UI | ✅ 后端可用 | `type` 参数从未被传（`:873-880`）→ 死能力 |
| 时间范围 | 无 UI | ❌ | |
| 刷新间隔 | `:829-834`、`:847` | — | 2s/5s/15s/暂停 |
| 批量选择 / 清理终态 | `:999-1005`、`:1377-1393` | 部分 ✅ | **只针对当前页**的终态行（`visibleRows`），无法「按筛选清空」 |
| 死信抽屉 | `:642-776` | ✅ | 固定 `pageSize:100, pageIndex:0`（`:655`），无翻页、无 total |
| 日志控制台 | `:350-361` | ✅ | 固定 200 条、2s 轮询整段重取，无增量游标 |

> 结论：前端呈现出的「筛选体系」看起来有 4 维，实际只有 2 维落在服务端（status/queue），搜索与「清理终态」都是本页级操作，跨页不可用。

### 2.5 listJobs 的其它实测缺陷

| # | 缺陷 | 证据 | 影响 |
|---|---|---|---|
| 1 | 列表返回全部列（含 `payload`、`result` jsonb） | `service.ts:361` `db.select()` | 响应体膨胀，20 行即可达几十 KB；前端表格完全用不到（`tasks-page.tsx:1024-1100`） |
| 2 | 列表 + count 每次都跑全条件聚合 | `service.ts:359-368` | 每次轮询 2 条查询（列表 + count）；5s 档 + 侧栏 30s（`admin-shell.tsx:42-49`）叠加 |
| 3 | 无稳定排序键 | `service.ts:364` | 分页漂移 |
| 4 | 越界 pageIndex 静默返回空 | `service.ts:366` | 「空列表」与「真的没有数据」不可区分 |
| 5 | 空串过滤 `?status=` → 全空 | `model.ts:26-28` | 契约脆弱 |
| 6 | `status`/`type`/`queue` 都是无约束 `varchar` | `task-log.ts:20-24` | 任意字符串都能查（无 400），排查时误导 |

---

## 3. 统计接口

### 3.1 `getTaskStats` 口径（**没有 500 条上限**）

```ts
// apps/api/src/modules/tasks/service.ts:374-397
const rows = await db.select({ status: queueJob.status, count: count() })
  .from(queueJob).groupBy(queueJob.status)          // 全表，无 where、无 limit、无时间窗
const counts = { queued:0, running:0, completed:0, failed:0,
                 'dead-letter':0, interrupted:0 }   // 6 个 key 预置 0
// total 逐组累加
return { counts, total }
```

- **无 500 条截断、无「最近 N 条」窗口**。数据量由保留期决定：`QUEUE_JOB_RETENTION_DAYS` 默认 90 天（`libs/queue/config.ts:13-16`），清理任务每天 4:00 跑一次（`service.ts:955-959`）。
- 量级估算（用于判断 count 成本）：cloudreve 每 30 分钟一次 → 48 行/天（`service.ts:935-939`），加手动触发与 meili 周任务，90 天通常 < 1 万行。**count 成本目前可接受，但随保留期/触发频率放大**。
- 所谓「500」的真实来源只有两处，都与统计无关：
  - API 日志分页 `pageSize: maximum 500`（`model.ts:35`）；
  - BFF 日志/死信 `z.maximum(500)`（`server/admin/tasks.ts:151`、`:194`）。
- 前端文案错误：`tasks-page.tsx:1275-1281` 用 `stats.total` 显示「记录总数」却标注 `hint="最近 500 条"`。**建议随重构一并删除或改为「全表（90 天保留）」**。

### 3.2 是否与筛选联动

**不联动**。`GET /tasks/stats` 不接任何 query（`index.ts:32`，`getTaskStats()` 无参），而列表是按 `status`+`queue` 过滤的：

- Tabs 徽标：`tasks-page.tsx:1304-1317`，取全局 `counts[key]` 或全局 `stats.total`；
- KPI 卡点击切换筛选：`:1253-1274`；
- 于是「选中 VNDB 队列 → 失败徽标仍显示全站失败数 → 点进去 total 变小」这种不一致是必然的。

### 3.3 `getQueueStats` 数据来源

```ts
// service.ts:400-428
if (!isQueueEnabled) return QUEUE.map(...全 0)          // :401-411  dev 无 Redis
for (const name of queues) {                            // :414  ← 串行 for-await
  const counts = await queueOf(name).getJobCounts()     // :416  Redis 一次往返
  result.push({ queue, waiting, active, completed, failed, delayed, paused })
}
```

- 来源是 **Redis（bun-queue `getJobCounts()`）**，与列表/统计的 **PostgreSQL 是两个真相源**。
- 5 个队列**串行** 5 次 Redis 往返（`:414-426`），页面 5s 轮询一次（`tasks-page.tsx:864-868`）。
- 计数口径受 job options 影响：`removeOnComplete: true`（`config.ts:59-64`）意味着完成后立即从 Redis 集合移除 → **`completed` 很可能恒为 0**（前端 `tasks-page.tsx:337-339` 展示「完成 N」）；`removeOnFail: 100` 让 `failed` 最多 100。**此项为静态推断，需生产 Redis 实测确认**（记为待验证项 V-1）。
- 没有缓存，没有 `Promise.all`。

### 3.4 调用频率（轮询放大的来源）

| 调用方 | 间隔 | 证据 |
|---|---|---|
| 任务页 KPI（stats） | 2s / 5s / 15s，可暂停 | `tasks-page.tsx:858-862` |
| 任务页队列卡（queues） | 同上 | `:864-868` |
| 任务页列表 | 同上 | `:870-883` |
| 后台侧栏徽标（stats） | 30s，全站所有后台页 | `admin-shell.tsx:42-49` |

即便 queryKey 相同（`adminKeys.taskStats()`，`lib/admin/query-keys.ts:55`）会复用缓存，两个 `refetchInterval` 仍会互相触发刷新：stats 在 2s 档下可能被侧栏 30s 覆盖/反之，实际频率不可控。V2 应让 count 与列表同源（一次请求）+ Redis 短 TTL 缓存。

---

## 4. 死信接口契约

### 4.1 `GET /tasks/deadLetter/:queue`

```ts
// service.ts:214-231
if (!isQueueEnabled) return []                                   // :219  dev 返回空数组（不报错）
const queue = queueOf(queueName as ...)                          // :220  ← 只是类型断言，未校验白名单
const start = pageIndex * pageSize                               // :221
const jobs = await queue.getDeadLetterJobs(start, start + pageSize - 1)  // :222
return jobs.map(job => ({ id, type, failedReason, attemptsMade, stacktrace, timestamp }))
```

- 底层是 `Queue.getDeadLetterJobs(start, end)`（`node_modules/@stacksjs/bun-queue/dist/queue.d.ts:44`），实现为 `LRANGE key start end`（`dist/index.js` 中 `getJobs` → `redisClient.send("LRANGE", ...)`），**end 为闭区间**，故 `start + pageSize - 1` 正确取满 `pageSize` 条。
- **无 total、无 hasMore**：前端无法判断是否还有下一页（现在干脆写死 `pageIndex:0, pageSize:100`，`tasks-page.tsx:655`）。
- **`:queue` 无白名单**：`queueParam` 只是 `t.String()`（`model.ts:10-12`），传 `/deadLetter/foo` 会用一个不存在的队列名建实例并返回 `[]`（静默 200），而不是 400。
- **队列未启用时语义不一致**：dev（`isQueueEnabled=false`）静默返回 `[]`，而 republish/remove 在同样条件下抛 503（`:236`、`:252`）——同一个「队列不可用」有两种表达。

### 4.2 `POST .../republish` / `.../remove`

```ts
// republish: service.ts:234-247
if (!isQueueEnabled) throw status(503, '队列不可用（Redis 未启用）')   // :236
const job = await queue.republishDeadLetterJob(jobId, { resetRetries: true })
if (!job) throw status(404, `死信任务不存在: ${jobId}`)              // :241
await TaskLifecycle.markRequeued(jobId)                              // :245  PG 侧回到 queued（同 id）
return { ok: true, jobId }                                           // :246

// remove: service.ts:250-259
if (!isQueueEnabled) throw status(503, ...)                          // :252
const ok = await queue.removeDeadLetterJob(jobId)
if (!ok) throw status(404, ...)                                      // :256
await db.delete(queueJob).where(eq(queueJob.id, jobId))              // :257
return { ok: true }
```

| 语义 | 现状 | 幂等性 |
|---|---|---|
| republish | DLQ 出队 → 回原队列，**保留原 jobId**，PG `status=queued`、`progress=0`、`error=null` | ❌ 第二次返回 **404**（第一次已在 DLQ 移除该 job） |
| remove | DLQ 移除 + PG 记录删除 | ❌ 第二次返回 **404**；对「已删除」不应报 404 |
| 两者 | 均要求 `:queue` 与原队列一致（DLQ key 按原队列名构造），传错队列 → 404 | 契约上 `:queue` 是身份的一部分，需在文档中写明 |

---

## 5. retry / delete / batchDelete 语义

### 5.1 `retryJob`（`service.ts:315-342`）

```ts
if (!job) throw status(404, ...)                                     // :322
const retryable = ['failed','dead-letter','interrupted'].includes(job.status)  // :324
if (!retryable) throw status(400, `仅失败/死信/中断的任务可重试（当前: ...）`)  // :327-329
if (!payload.type) throw status(400, ...)                            // :332-333
if (job.status === 'dead-letter') return republishDeadLetterJob(job.queue, jobId)  // :336-338
const newJobId = await enqueue(job.queue, payload)                   // :340  ← 新 jobId，原记录保留终态
return { ok: true, jobId: newJobId }
```

| 维度 | 现状 | 风险 |
|---|---|---|
| dead-letter | 复用原 id（DLQ 重放） | 返回的 `jobId` 与入参相同，语义与下面分支不一致，前端难统一处理 |
| 其它终态 | **新建 job**（新 id） | **非幂等**：连点 3 次 → 3 个 `vndb-full`（重任务）排队；只有业务内部锁兜底（`service.ts:477-481` 注释：`VndbSync` 自带分布式锁，返回 undefined 表示被占用） |
| 并发保护 | 无 | 建议 V2 加「同 queue+type 已有 queued/running → 409」 |
| 状态校验 | 有（白名单 3 状态） | 但只校验单条，无「重试中」态标记 |

### 5.2 `deleteJob`（`service.ts:262-284`）

- 不存在 → 404（`:269`）；**允许删除 running/queued 任务**：会先 `queue.removeJob`（`:272-279`，异常吞掉）再从 PG 删除。
- 先删日志（`:281`）再删 job（`:282`），**两条语句无事务**：若第二条失败，任务记录还在但日志已永久丢失且无法回滚；FK `ON DELETE CASCADE`（`drizzle/0022_db_hardening_followups.sql:36-48`）在这里帮不上忙——它保证的是「删 job 时级联删 log」，而代码主动先删了 log。
- 无「终态」校验 → 管理员可误删运行中的全量同步（记录消失但 Redis 侧可能仍在跑，取决于 removeJob 是否成功）。

### 5.3 `batchDeleteJobs`（`service.ts:287-312`）

```ts
if (jobIds.length === 0) return { ok: true, deleted: 0 }             // :288  但 body 已要求 minItems:1
if (isQueueEnabled) { 逐条 removeJob，异常吞 }                        // :291-304
await db.delete(queueJobLog).where(inArray(...))                     // :306
const deleted = await db.delete(queueJob).where(inArray(...)).returning({id})  // :307-310
return { ok: true, deleted: deleted.length }                         // :311
```

| 维度 | 现状 | 结论 |
|---|---|---|
| 上限 | `minItems: 1`，**无 maxItems**（`model.ts:20-22`） | 一次传 5000 个 id 会拼出超大 `IN` + 5000 条 Redis 往返 |
| 事务 | ❌（`:306-310`） | 日志删了、job 没删 |
| 幂等 | ✅ 部分（不存在的 id 直接不计入 `deleted`） | 但**不回报哪些 id 不存在** |
| 权限 | `isAdmin` | ✅ |
| 返回值 | `{ ok, deleted }` | 缺 `requested`/`missing`/`failed` |

### 5.4 `enqueue`（`service.ts:191-209`）

- 白名单校验 `isValidTask(queue, type)`（`libs/queue/types.ts:44-48`）→ 400（`service.ts:193`）。
- dev 无 Redis：meili 类同步执行返回 `sync:...` 伪 id（`:197-201`），其余**抛普通 `Error`**（`:202`）→ 500，与死信接口的 503（`:236`）不一致，V2 需统一为 503 `QUEUE_UNAVAILABLE`。

---

## 6. 索引现状与缺口

### 6.1 现状（schema 与迁移一致）

```ts
// apps/api/src/db/schema/task-log.ts:39-45
queueIdx:      index('idx_queue_job_queue').on(table.queue)              // :40
typeIdx:       index('idx_queue_job_type').on(table.type)                // :41
statusIdx:     index('idx_queue_job_status').on(table.status)            // :42
createdAtIdx:  index('idx_queue_job_created_at').on(table.createdAt)     // :44
// queueJobLog :64-71
jobCreatedIdx: index('idx_queue_job_log_job_created').on(table.jobId, table.createdAt)  // :66-69
createdAtIdx:  index('idx_queue_job_log_created_at').on(table.createdAt)                // :70
```
对应 SQL：`apps/api/drizzle/0012_bent_chimera.sql:23-28`（含 PK `id varchar(255)`，`:2`）。

**现有能力评估**

| 查询形态 | 是否命中 | 说明 |
|---|---|---|
| `WHERE queue=?` + `ORDER BY created_at DESC LIMIT 20` | 半 | 走 queue 索引后需 Sort；或走 created_at 逆扫 + filter（依赖选择率） |
| `WHERE status=?` + 排序 | 半 | status 只有 6 个值（低基数），planner 常直接 seq scan |
| `WHERE status=? AND queue=?` + 排序 | 半 | 两索引 bitmap AND + Sort |
| `ORDER BY created_at DESC` 无过滤（默认视图） | ✅ | `idx_queue_job_created_at` 逆扫 |
| `LIKE '%kw%'`（V2 的 q） | ❌ | 无 trgm 索引 |
| `ORDER BY started_at / finished_at` | ❌ | 无索引 |
| TTL 清理 `WHERE created_at < cutoff` | ✅ | `idx_queue_job_created_at`（`service.ts:645-656`） |
| 日志按 job 时间流 | ✅ | `(job_id, created_at)` 前缀等值 + 逆扫 |

### 6.2 排序白名单缺哪些索引（直接回答）

V2 若允许 `sort ∈ {createdAt, startedAt, finishedAt, status, type}`，则缺：

| 排序字段 | 缺失索引 | 备注 |
|---|---|---|
| `createdAt`（默认） | `idx_queue_job_created_id (created_at DESC, id DESC)` | 现在只有单列；同毫秒多行分页需要二级键 `id` 才能稳定，而 PK 是独立 btree，帮不上「按 created_at 排序」 |
| `startedAt` | `(started_at DESC NULLS LAST)` | queued 任务该列为 NULL，占多数 |
| `finishedAt` | `(finished_at DESC NULLS LAST)` | 同上；NULL 多时几乎全表 |
| `status` | `(status, created_at DESC)` | 单列 status 不提供顺序 |
| `type` | `(type, created_at DESC)` | 同上 |

**建议落地索引（新增 btree 7 条 + trgm 1~2 条）**

```ts
// 追加到 task-log.ts 的 table 回调（drizzle-orm 0.45 支持 .desc()）
(table) => ({
  // —— 默认排序 + 高频单维过滤（替代现有 3 条单列索引）
  queueCreatedIdx:  index('idx_queue_job_queue_created').on(table.queue, table.createdAt.desc()),
  statusCreatedIdx: index('idx_queue_job_status_created').on(table.status, table.createdAt.desc()),
  typeCreatedIdx:   index('idx_queue_job_type_created').on(table.type, table.createdAt.desc()),
  // —— 最常用组合：Tabs(状态) × 队列筛选
  queueStatusCreatedIdx: index('idx_queue_job_queue_status_created')
    .on(table.queue, table.status, table.createdAt.desc()),
  // —— 默认视图：ORDER BY created_at DESC, id DESC 完全走索引（免 Sort）
  createdIdIdx: index('idx_queue_job_created_id')
    .on(table.createdAt.desc(), table.id.desc()),
  // —— 排序白名单新增两项
  startedIdx:  index('idx_queue_job_started_at').on(table.startedAt.desc()),
  finishedIdx: index('idx_queue_job_finished_at').on(table.finishedAt.desc()),
  // created_at 保留：TTL 清理（Service.runPruneHandler）依赖 range 扫描
  createdAtIdx: index('idx_queue_job_created_at').on(table.createdAt),
})
```

> ⚠️ 单列 `idx_queue_job_queue`/`_status`/`_type` 在组合索引落地后成为「前缀可覆盖」的冗余索引。本仓库有先例：`drizzle/0023_perf_indexes_and_dedup.sql:4-12` 就是「用组合索引顶替欠覆盖索引」，DROP 与 CREATE 都带 `IF [NOT] EXISTS` 以保证幂等（同文件 `:2-3` 注释）。建议同 0023 的做法：`DROP INDEX IF EXISTS` 旧 3 条 + `CREATE INDEX IF NOT EXISTS` 新组合。

**关键字搜索索引（trgm）**

`q` 若要支持「任务 ID 子串 / 错误文本」搜索，必须 pg_trgm GIN（本仓库已有先例：`0009_producers_trigram.sql:1-7`、`0023:14-28`，且 0023 明确写了「自定义 operator class 不写进 drizzle schema，因此手写」）：

```sql
-- apps/api/drizzle/00XX_queue_job_search_indexes.sql（手写迁移，参照 0023 风格）
-- pg_trgm 已由 0009 启用
CREATE INDEX IF NOT EXISTS "idx_queue_job_id_trgm"
  ON "galrc_queue_job" USING gin ("id" gin_trgm_ops);
-- 可选：错误文本搜索（text 列可能很长，先 left(error, 500) 表达式索引更省）
CREATE INDEX IF NOT EXISTS "idx_queue_job_error_trgm"
  ON "galrc_queue_job" USING gin ("error" gin_trgm_ops);
```

> 若只支持「任务 ID 前缀」搜索，则可用 `text_pattern_ops` 的 btree 替代（`CREATE INDEX ... ON galrc_queue_job ("id" varchar_pattern_ops)`），成本更低；但前端体验上子串更合适，建议 trgm。

**count 成本**：`total` 与列表同 where（`service.ts:367`）。在 < 1 万行规模，组合索引足够；若保留期放大或轮询密集，用 `withCounts=false` + Redis 5s 缓存（缓存键先例：`modules/strategy/service.ts:302-306` 用 md5(JSON(params))）。

---

## 7. 权限与错误码

### 7.1 `isAdmin` 宏

```ts
// apps/api/src/modules/auth/index.ts:59-77
auth:    { resolve } → 无 session → throw status(401, '请先登录喵～')                  // :63
isAdmin: { resolve } → 无 session → 401                                              // :70
                       → role !== 'admin' → throw status(403, '该用户不具有管理员权限喵～')  // :71-72
```
tasks 插件整体 `.use(betterAuth)`（`modules/tasks/index.ts:30`），所有路由挂 `isAdmin`（逐条见 §1）。

### 7.2 `status()` 用法与响应体

- 业务错误统一 `throw status(code, message)`（`service.ts:193, 236, 241, 252, 256, 269, 322, 328, 333`）。
- 全局 `onError`（`apps/api/src/index.ts:37-57`）：
  - `VALIDATION` → `set.status=400` + **返回 `error.message` 字符串**（`:38-41`）；前端拿到的 `error.value` 就是纯字符串。
  - 4xx 不打印日志（`:42-47`），5xx 打印（`:48-56`）。
- `status()` 第二参是泛型（`elysia/dist/error.d.ts:22`：`const T = ...`），**因此可以传对象体** `status(400, { code, message })`；这不破坏前端，因为 `elysiaErrorF` 的 `toMessage` 优先取 `value.message`（`apps/web-tanstack/src/lib/elysia-error.ts:10-14`）。

### 7.3 前端 403 应如何处理（现状与建议）

现状事实：

- 导航层已挡：`routes/admin/_authL.tsx:13-21` 在 `beforeLoad` 里 `getSession()`，无 session → 跳登录，`role !== 'admin'` → 跳 `/`。因此 403 只可能来自「会话角色在页面打开后被降级 / 直接调用 BFF / 旧 tab」。
- **前端拿不到 HTTP 状态码**：`elysia-error.ts:16-22` 注释明确「TanStack Start 的 server fn 错误协议跨进程往返时只保留 message，`status` 在客户端不可用」，`elysiaErrorF` 只抛 `ApiError(message)`（`:39-43`）。所以页面**无法按 status 分支**。

建议（V2 一并落地）：

1. **API 侧**：403/401 返回结构化体 `{ code: 'FORBIDDEN' | 'UNAUTHENTICATED', message }`（用 `status(403, {...})`），并在**全局 onError 的 VALIDATION 分支**也改成 `{ code: 'VALIDATION_ERROR', message }`（一次全局改动；已确认 `toMessage` 兼容，且需 grep 确认无其它消费者直接读字符串 `error.value`）。
2. **BFF 侧**：`server/admin/tasks.ts` 里把 `ApiError` 转成「机器码 + message」的错误（如 `FORBIDDEN|该用户不具有管理员权限喵～`），因为跨进程只剩 message —— 这是本仓库约束下唯一可靠的带外通道。
3. **UI 侧**：403 不重试、不整页 `errorComponent`，而是 toast「权限不足」+ `router.navigate({ to: '/' })`；401 走登录跳转；503 显示「队列不可用（Redis 未启用）」并提供重试按钮。

---

## 8. Tasks API 契约 V2

### 8.1 设计原则

1. **只增不改**：V1 全部参数与响应字段保持语义不变；新增能力都是可选参数 / 新增字段。
2. **一次请求拿到「列表 + 总数 + 分面计数」**，消灭 stats/list 两个真相源。
3. **筛选与计数同口径**：`counts` 是「在除 status 之外的筛选条件下的 status 分面」，点 Tab 后 `total` 与徽标一致。
4. **排序白名单 + 稳定二级键 `id`**，杜绝分页漂移。
5. **列表做投影下沉**（不含 `payload`/`result`），详情接口保留全字段。
6. **写操作明确幂等语义**，批量接口逐项回报。
7. 唯一破坏性变更：死信列表由「裸数组」→ envelope（消费者只有 `tasks-page.tsx:642-776`，同 PR 收口）。

### 8.2 query 参数（`GET /tasks`）

| 参数 | 类型 | 默认 | 语义 | V1 兼容 |
|---|---|---|---|---|
| `q` | string 1..100 | – | 关键字：`id` / `type` 子串（可选含 `error`） | 新增 |
| `status` | string | – | 单状态等值 | ✅ 原样 |
| `statuses` | string \| string[] | – | 多状态 `IN` | 新增 |
| `queue` | string | – | 单队列等值 | ✅ 原样 |
| `queues` | string \| string[] | – | 多队列 `IN` | 新增 |
| `type` | string | – | 单类型等值（补齐死能力） | ✅ 原样 |
| `types` | string \| string[] | – | 多类型 `IN` | 新增 |
| `dateFrom` | ISO8601 string | – | `created_at >= from` | 新增 |
| `dateTo` | ISO8601 string | – | `created_at < to`（半开） | 新增 |
| `sort` | `createdAt\|startedAt\|finishedAt\|status\|type` | `createdAt` | 排序白名单 | 新增 |
| `order` | `asc\|desc` | `desc` | 方向 | 新增 |
| `page` | number ≥ 1 | – | 1 基页码，与 `pageIndex` 二选一（同时传以 `page` 为准） | 新增 |
| `pageIndex` | number ≥ 0 | 0 | 0 基偏移页 | ✅ 原样 |
| `pageSize` | number 1..100 | 20 | 每页条数（上限维持 100，避免破坏） | ✅ 原样 |
| `withCounts` | boolean | true | 是否返回 `counts` 分面 | 新增 |

**为什么 `queues`/`statuses`/`types` 用 `string | string[]` 而不是 `t.Array(t.Literal(...))`**：Elysia 的 query 解析器 `parseQuery` 对重复 key 才产出数组，**逗号不拆分**（`elysia/dist/parse-query.js:124-161`，`processKeyValuePair` 只在 `array` 模式下才 `split(',')`，普通 `parseQuery` 不拆）。因此线上可能是 `?statuses=failed&statuses=running`（数组）或 `?statuses=failed,running`（单串）。用 Union 承接、在 service 归一化后再逐值校验（非法值 → 400 `INVALID_FILTER`）是唯一稳的写法。

### 8.3 TypeBox（可直接落地，追加到 `model.ts`，不改动 V1 导出）

```ts
import { t } from 'elysia'

export namespace TasksModel {
  /* ── V1：保持原样，勿改语义 ───────────────────────────────── */
  export const listQuery = t.Object({
    queue: t.Optional(t.String()),
    type: t.Optional(t.String()),
    status: t.Optional(t.String()),
    pageSize: t.Number({ minimum: 1, maximum: 100, default: 20 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
  })
  // logsQuery / queueParam / enqueueBody / deadLetterJobBody / batchDeleteBody 原样保留

  /* ── V2 ─────────────────────────────────────────────────── */

  /** 任务状态白名单（与 task-log.ts:23 注释、前端 statusConfig 一致）。 */
  export const TASK_STATUSES = [
    'queued',
    'running',
    'completed',
    'failed',
    'dead-letter',
    'interrupted',
  ] as const

  /** 排序白名单：只允许这几列，杜绝任意列排序。 */
  export const TASK_SORT_FIELDS = [
    'createdAt',
    'startedAt',
    'finishedAt',
    'status',
    'type',
  ] as const

  /**
   * 多值过滤：Elysia 的 query 解析器只在重复 key 时产出数组，
   * 逗号形式会以单串到达（elysia/dist/parse-query.js:124-161）。
   * 故用 Union 承接，service 归一化后再校验白名单。
   */
  const MultiString = t.Optional(
    t.Union([t.String({ minLength: 1 }), t.Array(t.String({ minLength: 1 }))]),
  )

  export const listQueryV2 = t.Object({
    // —— V1 兼容（语义不变）
    queue: t.Optional(t.String({ minLength: 1 })),
    type: t.Optional(t.String({ minLength: 1 })),
    status: t.Optional(t.String({ minLength: 1 })),
    pageIndex: t.Optional(t.Number({ minimum: 0, default: 0 })),
    pageSize: t.Number({ minimum: 1, maximum: 100, default: 20 }),

    // —— V2 新增
    q: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    statuses: MultiString,
    queues: MultiString,
    types: MultiString,
    // 时间范围用普通 string + 手工解析：仓库内没有任何 model 使用 t.String({ format })，
    // 无法确认 format 校验真的生效；写它只会给人「已校验」的错觉，必须手工解析。
    dateFrom: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
    dateTo: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
    sort: t.Optional(t.Union(TASK_SORT_FIELDS.map((f) => t.Literal(f)))),
    order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
    // 1 基页码；与 pageIndex 并存时以 page 为准
    page: t.Optional(t.Number({ minimum: 1 })),
    // 布尔 query 在本仓库是既有约定：search/model.ts:37 includeFacets、comments/model.ts:11
    withCounts: t.Optional(t.Boolean({ default: true })),
  })

  /** 批量操作请求体（统一叫 ids，含上限，防超大 IN / 5000 次 Redis 往返）。 */
  export const batchBodyV2 = t.Object({
    ids: t.Array(t.String({ minLength: 1, maxLength: 255 }), {
      minItems: 1,
      maxItems: 500,
    }),
    /** 仅删除：为 true 时只回报影响面，不真正删除。 */
    dryRun: t.Optional(t.Boolean({ default: false })),
  })

  /** 死信批量（上限更小：每条都是一次 Redis 往返）。 */
  export const deadLetterBatchBodyV2 = t.Object({
    jobIds: t.Array(t.String({ minLength: 1, maxLength: 255 }), {
      minItems: 1,
      maxItems: 100,
    }),
  })

  /** 死信列表查询（在 logsQuery 基础上加 withTotal）。 */
  export const deadLetterQueryV2 = t.Object({
    pageSize: t.Number({ minimum: 1, maximum: 500, default: 100 }),
    pageIndex: t.Number({ minimum: 0, default: 0 }),
    withTotal: t.Optional(t.Boolean({ default: true })),
  })

  /** 日志增量拉取（轮询用）。 */
  export const logsQueryV2 = t.Object({
    limit: t.Number({ minimum: 1, maximum: 500, default: 100 }),
    /** 只取 id 大于该值的日志（增量轮询）；省略则按倒序取最近 limit 条。 */
    afterId: t.Optional(t.Number({ minimum: 0 })),
    /** 可选级别过滤 */
    level: t.Optional(
      t.Union(['info', 'warn', 'error', 'success'].map((l) => t.Literal(l))),
    ),
  })

  /** 队列路径参数：从 t.String() 收紧为枚举，非法队列直接 400。 */
  export const queueParamV2 = t.Object({
    queue: t.Union([
      t.Literal('galzy:vndb-sync'),
      t.Literal('galzy:kungal-sync'),
      t.Literal('galzy:meili-index'),
      t.Literal('galzy:cloudreve-sync'),
      t.Literal('galzy:metrics'),
    ]),
  })

  export type listQueryV2 = typeof listQueryV2.static
  export type batchBodyV2 = typeof batchBodyV2.static
  export type logsQueryV2 = typeof logsQueryV2.static
}
```

> 队列名建议改为从 `libs/queue/types.ts:10-21` 的 `QUEUE` 派生（`Object.values(QUEUE).map(v => t.Literal(v))`），避免两处硬编码漂移。

### 8.4 响应 envelope

```ts
/** GET /tasks（V2） */
type TaskListResponseV2 = {
  items: Array<{
    id: string
    queue: string
    type: string
    status: 'queued' | 'running' | 'completed' | 'failed' | 'dead-letter' | 'interrupted'
    progress: number
    /** 截断到 500 字符，完整错误走详情接口（避免列表被超长 stack 撑爆） */
    error: string | null
    startedAt: string | null
    finishedAt: string | null
    createdAt: string
  }>
  total: number          // 与全部筛选条件一致（含 status）
  page: number           // 1 基
  pageIndex: number      // 0 基（V1 兼容回显）
  pageSize: number
  totalPages: number
  /** 分面：在「除 status/statuses 之外」的筛选条件下，各状态的计数 */
  counts?: Record<string, number>
  /** 归一化后的实际生效条件，便于前端回显 / 调试（防止前后端对默认值理解不一致） */
  applied: {
    q: string | null
    queues: string[]
    types: string[]
    statuses: string[]
    dateFrom: string | null
    dateTo: string | null
    sort: string
    order: 'asc' | 'desc'
  }
}
```

**counts 口径（必须写进文档，否则又会不一致）**

- `counts` = `GROUP BY status`，where = `q` + `queues` + `types` + `dateFrom/dateTo`（**不含 status**）。
- `total` = 同一 where **加上** status 条件的精确计数。
- 因此：点任意 Tab 后 `total === counts[tab]` 恒成立；「全部」Tab 的数字 = `sum(counts)`。
- 六个 key 恒存在（预置 0，参照 `service.ts:383-390`）。
- `withCounts=false` 时 `counts` 字段整个省略（而非空对象），前端用 `placeholderData` 保留上一帧。

**死信 envelope（唯一破坏性变更）**

```ts
type DeadLetterListResponseV2 = {
  items: Array<{
    id: string
    type: string
    failedReason: string | null
    attemptsMade: number
    stacktrace: string[]
    timestamp: number
  }>
  page: number
  pageIndex: number
  pageSize: number
  /** bun-queue 未提供 DLQ 计数 API；用「多取 1 条」判断是否还有下一页，不做 O(n) 全量计数 */
  hasMore: boolean
  total?: number   // withTotal=true 且队列规模小的时候才给；否则省略
}
```

**日志 envelope（增量轮询）**

```ts
type JobLogsResponseV2 = {
  items: Array<{ id: number; jobId: string; level: string; message: string; createdAt: string }>
  /** 下一次轮询传 afterId = items.at(-1)?.id，实现 O(增量) 拉取，替代现在每 2s 重取 200 条 */
  nextAfterId: number | null
}
```

### 8.5 批量接口

| 方法 | 路径 | Body | 语义 | 返回 |
|---|---|---|---|---|
| POST | `/tasks/batchDelete` | `{ ids: string[] (≤500), dryRun? }` | 事务内删除日志+记录；Redis 侧 best-effort | `{ ok, requested, deleted, missing: string[], failed: Array<{id, code, message}> }` |
| POST | `/tasks/batchRetry` | `{ ids: string[] (≤100) }` | 逐项重试，**不整体失败** | `{ ok, requested, succeeded, failed, results: Array<{ id, ok, mode: 'republish' | 'requeue', jobId?, newJobId?, code?, message? }> }` |
| POST | `/tasks/deadLetter/:queue/batchRepublish` | `{ jobIds: string[] (≤100) }` | 逐项重放 | 同上 results 形状 |
| POST | `/tasks/deadLetter/:queue/batchRemove` | `{ jobIds: string[] (≤100) }` | 逐项丢弃（幂等：已不存在计入 `missing`，不 404） | `{ ok, removed, missing } ` |
| POST | `/tasks/:jobId/retry` | – | **加并发保护**：同 `queue+type` 已有 queued/running → 409 `TASK_ALREADY_ACTIVE`（返回冲突 jobId） | `{ ok, jobId, newJobId?, mode }` |
| POST | `/tasks/:jobId/delete` | `{ force?: boolean }` | 非终态默认 409 `TASK_NOT_TERMINAL`；`force=true` 才允许（并先 removeJob 再删） | `{ ok, deleted: boolean }` |

批量语义约定：**逐项独立事务/独立结果，HTTP 永远 200**（除非整体校验失败 400）。前端按 `results` 展示「成功 N / 失败 M（原因）」，避免一条失败全量回滚导致用户重试成本。

### 8.6 错误码表

| HTTP | code | 触发点 | 现状证据 |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | query/body 不符合 schema | `apps/api/src/index.ts:37-41`（现返回纯字符串，V2 改对象体） |
| 400 | `INVALID_FILTER` | statuses/queues/types 含非法值 | 新增（现状无校验，`model.ts:26-28`） |
| 400 | `INVALID_SORT` | sort 不在白名单 | 新增 |
| 400 | `INVALID_DATE_RANGE` | dateFrom 不可解析 / dateFrom > dateTo | 新增 |
| 400 | `INVALID_TASK` | queue+type 不在白名单 | `service.ts:191-194`（现消息「非法任务: ...」） |
| 400 | `TASK_NOT_RETRYABLE` | 非 failed/dead-letter/interrupted 重试 | `service.ts:324-329` |
| 400 | `PAYLOAD_MISSING_TYPE` | payload 无 type 无法重试 | `service.ts:331-333` |
| 401 | `UNAUTHENTICATED` | 未登录 | `modules/auth/index.ts:63, 70` |
| 403 | `FORBIDDEN` | 非 admin | `modules/auth/index.ts:71-72` |
| 404 | `TASK_NOT_FOUND` | job 不存在 | `service.ts:269, 322` |
| 404 | `DEAD_LETTER_NOT_FOUND` | DLQ 无此 job | `service.ts:241, 256` |
| 409 | `TASK_NOT_TERMINAL` | 删除非终态任务（未 force） | 新增（现状直接删，`service.ts:262-284`） |
| 409 | `TASK_ALREADY_ACTIVE` | 同 queue+type 已有活跃任务 | 新增（现状可重复入队，`service.ts:340`） |
| 503 | `QUEUE_UNAVAILABLE` | Redis 未启用 | `service.ts:236, 252`；**`enqueue` 的 dev 分支不一致，现在抛普通 Error → 500**（`service.ts:196-203`） |
| 500 | `INTERNAL` | 其它 | `apps/api/src/index.ts:42-56` |

错误体统一：`{ code: string, message: string }`（`throw status(400, { code:'INVALID_SORT', message:'...' })`）。
前端兼容性已确认：`elysiaErrorF` → `toMessage` 取 `value.message`（`apps/web-tanstack/src/lib/elysia-error.ts:10-14`）。

### 8.7 Service 实现骨架（提案，未落地）

```ts
// apps/api/src/modules/tasks/service.ts（V2 提案）
// 依赖补充：db / queueJob 来自 '@api/libs'（现有文件已在 :1-9 导入），
// QUEUE / isValidTask 来自 '@api/libs/queue'（:11-18 已导入）。
import { and, or, gte, lt, ilike, inArray, sql, count } from 'drizzle-orm'
import { status } from 'elysia'
import { TasksModel } from './model'

/** LIKE 通配符转义：现状 like/ilike 直接拼用户输入（strategy/service.ts:317），% 会被当通配。 */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

/** 逗号串 / 单值 / 数组 → 去重数组 */
function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return []
  const raw = Array.isArray(v) ? v : v.split(',')
  return [...new Set(raw.map((s) => s.trim()).filter(Boolean))]
}

const SORT_COLUMNS = {
  createdAt: queueJob.createdAt,
  startedAt: queueJob.startedAt,
  finishedAt: queueJob.finishedAt,
  status: queueJob.status,
  type: queueJob.type,
} as const

/** 排序表达式工厂：NULLS LAST（queued 任务 startedAt/finishedAt 为 NULL，
 *  默认 DESC 会把 NULL 排在最前，导致「最新在前」语义被破坏） */
const orderExpr = (col: unknown, dir: 'asc' | 'desc') =>
  sql`${col} ${sql.raw(dir)} nulls last`

export async function listJobsV2(input: TasksModel.listQueryV2) {
  // 1) 归一化：page 优先于 pageIndex
  const pageSize = input.pageSize
  const page = input.page ?? (input.pageIndex ?? 0) + 1
  if (!Number.isInteger(page) || page < 1) throw status(400, { code: 'VALIDATION_ERROR', message: 'page 必须为正整数' })
  const offset = (page - 1) * pageSize

  // 2) 多值/单值合并 + 白名单校验
  const statuses = [...new Set([...toArray(input.statuses), ...(input.status ? [input.status] : [])])]
  const queues = [...new Set([...toArray(input.queues), ...(input.queue ? [input.queue] : [])])]
  const types = [...new Set([...toArray(input.types), ...(input.type ? [input.type] : [])])]
  const bad = (arr: string[], ok: readonly string[]) => arr.filter((v) => !ok.includes(v))
  if (bad(statuses, TasksModel.TASK_STATUSES).length) throw status(400, { code: 'INVALID_FILTER', message: '非法状态' })
  // queue 白名单直接用 libs/queue/types.ts 的 QUEUE
  // type 校验用 isValidTask 反查（一个 type 只属于一个 queue，见 QUEUE_TASKS）

  // 3) 时间区间（半开）
  const from = input.dateFrom ? new Date(input.dateFrom) : undefined
  const to = input.dateTo ? new Date(input.dateTo) : undefined
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from >= to)) {
    throw status(400, { code: 'INVALID_DATE_RANGE', message: '时间范围非法' })
  }

  // 4) where 拆分：base（不含 status）用于分面，final（含 status）用于列表/total
  const base = [
    queues.length ? inArray(queueJob.queue, queues) : undefined,
    types.length ? inArray(queueJob.type, types) : undefined,
    input.q
      ? or(
          ilike(queueJob.id, `%${escapeLike(input.q)}%`),
          ilike(queueJob.type, `%${escapeLike(input.q)}%`),
          ilike(queueJob.error, `%${escapeLike(input.q)}%`),
        )
      : undefined,
    from ? gte(queueJob.createdAt, from) : undefined,
    to ? lt(queueJob.createdAt, to) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined)
  const baseWhere = base.length ? and(...base) : undefined
  const finalWhere = statuses.length
    ? base.length ? and(...base, inArray(queueJob.status, statuses)) : inArray(queueJob.status, statuses)
    : baseWhere

  // 5) 排序：白名单列 + id 兜底，保证分页稳定
  const sortKey = (input.sort ?? 'createdAt') as keyof typeof SORT_COLUMNS
  const dir = input.order ?? 'desc'
  const orderBy = [
    orderExpr(SORT_COLUMNS[sortKey], dir),
    orderExpr(queueJob.id, dir), // 稳定二级键，杜绝分页漂移（batch/链式入队常见同毫秒创建）
  ]

  // 6) 三查询并行：列表（投影，不含 payload/result）+ total + 分面
  const [items, totalRow, facetRows] = await Promise.all([
    db.select({
      id: queueJob.id, queue: queueJob.queue, type: queueJob.type,
      status: queueJob.status, progress: queueJob.progress,
      error: sql<string | null>`left(${queueJob.error}, 500)`,
      startedAt: queueJob.startedAt, finishedAt: queueJob.finishedAt, createdAt: queueJob.createdAt,
    }).from(queueJob).where(finalWhere).orderBy(...orderBy).limit(pageSize).offset(offset),
    db.select({ count: count() }).from(queueJob).where(finalWhere),
    input.withCounts === false
      ? Promise.resolve(null)
      : db.select({ status: queueJob.status, count: count() }).from(queueJob).where(baseWhere).groupBy(queueJob.status),
  ])

  const total = totalRow[0]?.count ?? 0
  const counts = facetRows
    ? Object.fromEntries([
        ...TasksModel.TASK_STATUSES.map((s) => [s, 0] as const),
        ...facetRows.map((r) => [r.status, r.count] as const),
      ])
    : undefined

  return {
    items, total, page, pageIndex: page - 1, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
    applied: { q: input.q ?? null, queues, types, statuses, dateFrom: input.dateFrom ?? null,
               dateTo: input.dateTo ?? null, sort: sortKey, order: dir },
  }
}
```

**stats 接口 V2**：接受与列表相同的筛选（不含 `statuses`），返回 `{ counts, total, byQueue, byType, filtered: boolean }`；实现上直接复用 `listJobsV2` 的 base where + 两次 `GROUP BY`。可加 5s Redis 缓存（键：`galzy:tasks:stats:<md5(filters)>`，先例 `strategy/service.ts:302-306`）。

**queue stats V2**：`Promise.all` 并发 5 个 `getJobCounts()` + 5s 缓存；并在响应中标注 `source: 'redis'` 与 `removeOnComplete` 导致的 `completed` 口径问题（`libs/queue/config.ts:59-64`）。

### 8.8 向后兼容策略

| # | 事项 | 策略 |
|---|---|---|
| 1 | `queue`/`type`/`status`/`pageIndex`/`pageSize` | 语义完全不变；新参数与旧参数**同时存在时取并集**（`status` 与 `statuses` 合并） |
| 2 | 响应 `{items,total}` | 纯增量：新增 `page/pageIndex/pageSize/totalPages/counts/applied`；旧消费者不受影响 |
| 3 | `GET /tasks/stats` | 形状不变（`{counts,total}`）+ 新增字段 |
| 4 | 死信列表裸数组 → envelope | **唯一破坏性变更**。消费者只有 `tasks-page.tsx:651-658`（`listDeadLetterTasks`），同 PR 改 BFF（`server/admin/tasks.ts:190-204`）与组件；不引入 `?shape=v2` 双轨（只会留下长期债） |
| 5 | `retry` 返回 `{ ok, jobId }` | 保留 `jobId`（requeue 时为新 id），新增 `mode`/`newJobId`；dead-letter 分支仍返回原 id，前端按 `mode` 区分文案 |
| 6 | `batchDelete` 返回 `{ ok, deleted }` | 保留 `deleted`，新增 `requested/missing/failed` |
| 7 | 错误体由字符串 → `{code,message}` | `elysiaErrorF`/`toMessage` 已兼容（`elysia-error.ts:10-14`）；**需 grep 确认无其它地方把 `error.value` 当字符串用**。VALIDATION 分支属全局改动，建议单独 PR 并全量回归 |
| 8 | 路径版本 | 不引入 `/v2` 前缀（内部管理接口、单一消费者）；契约演进记录在 `docs/task-queue-migration.md` 新增小节 |
| 9 | `queue` 路径参数收紧为枚举 | 从「静默 200 空数组」变为「400 `INVALID_FILTER`」，属行为修正，需在前端把 `queue` 取值限制在 QUEUE 列表（`tasks-page.tsx:104-110` 已经是固定字典） |

---

## 9. 风险与未验证项

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| V-1 | `getQueueStats().completed` 是否恒为 0 | **待生产验证** | 推断依据：`removeOnComplete: true`（`config.ts:62`）→ 完成后立即移出 Redis 集合 |
| V-2 | Elysia 对 `t.Number`/`t.Boolean` 的 query 强制转换 | 约定成立 | 全仓 27 处 `t.Number`/`t.Boolean` 用于 query（如 `search/model.ts:37`、`collections/model.ts:5-11`），V2 沿用同写法；新增参数仍建议联调一次 |
| V-3 | `parseQuery` 不拆逗号 | **已从源码确认** | `elysia/dist/parse-query.js:124-161`；故多值参数用 Union 承接 |
| V-4 | `status(4xx, {object})` 是否被原样作为 body | 类型层确认 | `elysia/dist/error.d.ts:22`（`const T = ...` 泛型）；落地时用一条路由实测 |
| V-5 | 现有 `like/ilike` 未转义 `%` | 既有缺陷 | `strategy/service.ts:317`；V2 的 `q` 必须转义，勿复制该写法 |
| V-6 | 死信 `total` 无法低成本取得 | 已知限制 | bun-queue 无 DLQ 计数 API（`queue.d.ts:44-46` 只有 `getDeadLetterJobs/republish/remove`），故用 `hasMore` |

---

## 10. 落地顺序（建议 PR 拆分）

1. **PR-A｜只读增强（无破坏）**：`listQueryV2` + `listJobsV2`（多值/时间/q/排序/分面/projection）+ 索引迁移（新增 btree 7 条 + 手写 trgm 1~2 条，DROP 冗余单列）。
2. **PR-B｜错误体与幂等**：`status(code, {code,message})` 统一、全局 VALIDATION 对象体、`enqueue` dev 分支改 503、`deleteJob`/`batchDelete` 加事务、retry 并发保护（409）。
3. **PR-C｜批量接口**：`batchRetry` / `batchRepublish` / `batchRemove` + `ids` 上限。
4. **PR-D｜死信与日志契约**：死信 envelope（`hasMore`）、`queueParamV2` 枚举、日志 `afterId` 增量。
5. **PR-E｜前端接入**：BFF（`server/admin/tasks.ts`）与 `tasks-page.tsx` 拆分同步改造；`adminKeys.tasks` 过滤器结构随之扩展（`lib/admin/query-keys.ts:53-58`）；删除「最近 500 条」文案。

> 顺序理由：A 只加不改最安全；B/C 涉及写语义，需独立回归；D 是唯一破坏点，与前端同 PR；E 依赖 A-D 全部就绪。
