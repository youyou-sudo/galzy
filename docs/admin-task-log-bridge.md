# 后台任务面板「日志 tab 永远是空的」修复记录

> 对象：`apps/api/src/libs/queue/task-context.ts`（新增）、`apps/api/src/modules/tasks/service.ts`、
> `apps/api/src/modules/{vndb-sync,kungal-sync,cron}/service.ts`
> 现象：`/admin/tasks` 任务详情抽屉的「日志」tab 对**执行成功的任务**永远显示「暂无日志」。
> 状态：已修复（2026-11-09）。

## 1. 诊断

### 1.1 面板读的是哪张表

`TaskLogConsole`（`apps/web/src/components/admin/tasks/task-detail/task-log-console.tsx`）
只调 `listTaskLogs` → `GET /tasks/:jobId/logs` → `galrc_queue_job_log`。
除此之外**没有任何**其它日志来源。

### 1.2 写这张表的是谁

只有 `modules/tasks/service.ts` 的 `JobLogger`。它在两条执行路径里被创建：

| 路径 | 触发条件 | 修复前实际写入的日志 |
|---|---|---|
| Worker | 生产（`NODE_ENV=production` + Redis） | **仅失败/重试/死信**（`error` / `warn`）；成功任务一行都不写 |
| 内联 | 本机 dev（无 Worker） | 「进程内联执行」「执行完成」两行 + 失败时的错误行 |

业务层的真实执行日志（阶段开始、每批进度、清理条数、完成摘要……）根本没经过 `JobLogger`：
`VndbSync` / `KungalSync` / `CronService` 的 `addLog` / `addMeiliLog`（以及
`updateProgress({ logs: [...] })` 里的首条日志）全部写在 `galrc_siteConfig` 的进度 JSON
（`vndbSyncProgress` / `kungalSyncProgress` / `meiliSearchProgress_*`）里，而那只服务于
旧同步页（`/admin/vndb-sync`、`/admin/kungal-sync`、`/admin/meilisearch`）。

### 1.3 线上数据实证（只读查询）

```sql
SELECT (SELECT count(*) FROM galrc_queue_job) AS jobs,
       (SELECT count(*) FROM galrc_queue_job_log) AS logs;
-- jobs=214, logs=19，且 19 行全部是 warn(9) / error(10)
```

最近 12 个任务里，所有 `completed` 任务的日志行数都是 **0**；只有那条
`kungal-characters` 的 failed/dead-letter 有 6–7 行（重试告警 + 错误信息）。
即：**成功任务零日志**，与「日志 tab 空白」完全对应。

## 2. 修复

### 2.1 任务上下文（新增 `libs/queue/task-context.ts`）

用一个 `AsyncLocalStorage` 把「当前正在执行的 job」暴露给业务层，**不改任何业务函数签名**
（否则要穿透 `VndbSync` / `KungalSync` 十几个内部方法的参数链）：

- `runInTaskLogContext(logger, run)`：Worker handler 与内联执行把整条执行链包进上下文；
- `forwardTaskLogs(entries)`：业务层写进度日志时，把**新增**条目转发到当前 job 的日志表；
- `getActiveTaskLogger()`：想直接写日志的业务代码可直接用。

没有任务在跑时（旧同步页手动跑、`getProgressForUi` 的对账写入等）转发是空操作，
siteConfig 进度照旧，旧页面零破坏。

### 2.2 转发规则（为什么不是「每次全量写一遍」）

业务层 `addLog` 的实现是「读整段 logs → push → 写回」，每次都会回传整段数组。
`forwardTaskLogs` 因此做两道过滤：

1. **时间水位**：只转发 `time >= 本次执行开始时刻` 的条目。进度 JSON 里残留着上一轮执行
   （甚至上一个进程）的日志，靠时间过滤，业务层不需要自己算增量；
2. **去重**：同一 `time|level|message` 在一次执行内只写一次。

重试时每次尝试各建一份上下文，水位随之上移，因此同一 job 的多次尝试不会互相串日志。

### 2.3 `JobLogger` 加固

- **串行写**：转发是 fire-and-forget，多条 `INSERT` 并发到达时靠内部 promise 链保证
  「日志表里的顺序 = 产生顺序」（否则控制台会看到乱序行）；
- **吞错**：日志是旁路。此前 `await logger.error(msg)` 若写库失败会从失败分支抛出，
  直接跳过终态写库，把 job 留成 `running` 僵尸行；
- **`close()`**：任务终态写库后关闭。业务层有 `void updateProgress(...)` 这类
  fire-and-forget 写入，可能在任务结束之后才 resolve，迟到日志/进度回写一律丢弃
  （否则「执行完成」后面还会挂行，进度也会把 100 覆盖回去）。

### 2.4 补齐生命周期日志

两条执行路径现在都写：

- 开始：`开始执行 <type>（第 N 次尝试）`
- 成功：`执行结果: <短摘要>`（≤200 字符才写）+ `执行完成，耗时 12.3s`

失败/重试/死信日志保持原有文案（线上告警检索锚点不变）。

## 3. 影响面与边界

- 只新增写入方，**不改日志查询契约**（`GET /tasks/:jobId/logs`、`afterId` 增量轮询原样）；
- 日志 TTL 仍是 `QUEUE_LOG_TTL_DAYS`（默认 14 天，由 metrics 队列的 `queue-log-prune` 清理）；
- 历史任务的日志**无法回填**：旧日志从来没有按 jobId 落库，与任务记录也没有可映射的键；
- 直接调用业务函数、但不经过队列的入口（`/vndb-sync/cloudreve/sync`、`/vndb-sync/tag-hierarchy`）
  本来就不产生任务记录，也不会产生任务日志——与修复前一致。
