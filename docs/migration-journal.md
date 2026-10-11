# Drizzle 迁移日志（`meta/_journal.json`）的约束与 2026-10-11 修正

## 为什么 `when` 必须严格递增

`drizzle-orm/bun-sql/migrator` 的实现（`pg-core/dialect.ts` 的 `migrate()`）是：

```js
const lastDbMigration = (await session.all(
  sql`select ... from drizzle.__drizzle_migrations order by created_at desc limit 1`
))[0]                       // ← 整批只读一次，循环中不更新

for (const migration of migrations) {
  if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
    // 应用这条迁移，然后插入 (hash, created_at = folderMillis)
  }
}
```

判定用的是「**当前日志表里最大的 created_at**」和「迁移文件的 `when`」，且这个基准在整批循环里
**只读一次、不更新**。因此队列里每条迁移的 `when` 必须严格递增，否则会出现：

> 日志表里已经有一条 `created_at` 更大的记录 → 后续所有 `when` 比它小的迁移
> **被永久静默跳过**，而且 `db:up` / 启动自动迁移都会报告「迁移已是最新」。

这正是本项目历史上踩过的坑（`0010_schema_hardening` 被 `0008` 挡住过一次，
见 `apps/api/src/db/migrate.ts` 的注释）。当时只修了 `0009`/`0010` 两条，
`0011`–`0020` 的 `when` 仍然低于 `0010`，`drizzle-kit check` 一直在告警。

## 修正内容

### 1. `when` 重排（`apps/api/drizzle/meta/_journal.json`）

把 `0011`–`0020` 的 `when` 抬到 `0010`（1791609097249）之上、`0021`（1791707040464）之下，
保持原有先后顺序，改成 `1791609097250` 起逐毫秒递增：

| tag | 原 `when` | 新 `when` |
|---|---|---|
| `0011_merge_topics_into_articles` | 1786099908665 | 1791609097250 |
| `0012_bent_chimera` | 1786686451970 | 1791609097251 |
| `0013_legal_the_order` | 1787290558390 | 1791609097252 |
| `0014_whole_silver_centurion` | 1787295792090 | 1791609097253 |
| `0015_dashing_sugar_man` | 1787296504263 | 1791609097254 |
| `0016_boring_ender_wiggin` | 1787305765076 | 1791609097255 |
| `0017_massive_magus` | 1787734055046 | 1791609097256 |
| `0018_tearful_logan` | 1788272087548 | 1791609097257 |
| `0019_first_kingpin` | 1788957022031 | 1791609097258 |
| `0020_tags_hierarchy` | 1791609097247 | 1791609097259 |

新值全部**低于** `0021`/`0022`/`0023`，所以对已经跑到 `0021`+ 的库（含当前生产库，
最大 `created_at` = 1791718336172）这 10 条仍然被跳过 —— 它们确实已经应用过。

### 2. 让 `0011`–`0023` 可安全重跑（幂等化）

抬高 `when` 的直接后果是：某些库（例如「已应用到 `0020` 但没到 `0021`」）会
**首次**去应用这 10 条；而「schema 效果已在、但日志缺行」的库会把 `0011`–`0023`
整段重放。为了让重跑无害，这 13 个文件的 DDL 都加了幂等关键字：

- `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX` / `CREATE UNIQUE INDEX` → 加 `IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN` → 加 `IF NOT EXISTS`
- `ALTER TABLE ... DROP COLUMN` → 加 `IF EXISTS`
- `DROP TABLE` → `DROP TABLE IF EXISTS`
- `0014` 的 `ADD CONSTRAINT` 用 `DO $$ ... pg_constraint ... $$` 守卫
  （`ADD CONSTRAINT` 不支持 `IF NOT EXISTS`，写法与 `0010_schema_hardening` 一致）

`0011` 是**破坏性数据搬迁**（把 `galrc_topics` 搬进 `galrc_article` 后删除旧表），
单独处理：以 `to_regclass('galrc_topics') IS NULL` 作为「搬迁已完成」的闸门，整体跳过，
因此绝不会把帖子重复搬进文章表。

`0021`–`0023` 原本也不幂等（`CREATE UNIQUE INDEX` / `CREATE TABLE galrc_stat_counters` /
`ADD CONSTRAINT` 都不带守卫），在「清掉日志行后重放」的回归测试里会直接报错中止整批迁移，
所以一并补齐：`IF NOT EXISTS` + `pg_constraint` 守卫 + `DROP INDEX IF EXISTS`。

> 注意顺序不变量：同一批应用时是按文件顺序执行的。所以「`0011` 重跑后重建
> `idx_galrc_comments_rootid_depth`」会被随后的 `0023` 再次删掉，前后自洽。

### 3. 日志表 hash 对账（drift reconciliation）

`drizzle.__drizzle_migrations.hash` 是迁移器写入的「本条内容摘要」（sha256 of 文件字节），
但迁移器**只写不校验**它。历史上日志表有 **39 行**（对 24 个迁移文件），其中
`0000`–`0008`、`0011`、`0020` 共 11 条记录的 hash 与当前文件不一致（文件在应用后被改过，
或日志是外部种入的），另外还有 15 行重复/遗留记录。本次又改动了 `0012`–`0019`、`0021`–`0023`
的语句（加幂等关键字），它们的 hash 也随之变化。

**已应用的历史内容无法找回**，因此采取「重新基线化」：把日志表重写为
每个迁移文件恰好一行、`hash` = 文件当前 sha256、`created_at` = 文件当前 `when`
（单个事务内完成）。迁移器的跳过判定只依赖 `created_at`，且新 `when` 仍全部 ≤
当前最大 `created_at`，所以重写不改变本库的已应用状态（`db:up` 依旧报「已是最新」）。
基线化之后，任何新的漂移都能被 `db:verify-migrations` 测出来。

```bash
bun --cwd apps/api db:verify-migrations              # 只读校验（CI / 部署前可跑）
bun --cwd apps/api db:verify-migrations -- --apply   # 对账（默认只打印计划）
```

## 日常约束

1. **不要手工编辑已应用的迁移文件语句**。要改 schema 就新增迁移（`db:generate`）。
   一旦改了旧文件，日志表 hash 就会漂移，`db:verify-migrations` 会报出来。
2. 手写迁移（`0004`、`0009`、`0010`、`0020`–`0023` 这类）必须用严格递增的 `when`。
   手写时**不要**填一个比最新已有迁移更小的值（历史事故就是这么来的）。
3. 合并/重排迁移前先跑 `bun --cwd apps/api db:check`，它会对 `when` 不递增告警。
4. 新增迁移一律写成幂等的（`IF NOT EXISTS` / `IF EXISTS` / `pg_constraint` 守卫）：
   「日志缺行但效果已在」的库重放时才不会整批中止。`0011` 这类数据搬迁要自带
   「是否已完成」的闸门。
5. 改完迁移文件后跑一次 `bun --cwd apps/api db:verify-migrations`；
   发版前也建议跑（只读，有问题退出码 1）。

## 已知边界（本次未改）

`0004_collections_tables` 是「**替换式**」迁移：它先 `DROP TABLE IF EXISTS "galrc_collections"`
再重建，重放会**丢数据**。它的 `when` 未被抬高，所以本次修正触及不到它；
但将来若有人再调整 `0000`–`0010` 的 `when`，必须先给它加「是否已迁移过」的闸门
（参考 `0011` 用 `to_regclass(...) IS NULL` 的写法），否则重放即丢数据。

另外，`0000`–`0008` 属于最初从外部（Kysely 时代的建库脚本）引导过来的部分，
它们创建的对象与外部脚本创建的遗留索引并存过。库内在用的一套索引已由
`0023` 与 `scripts/drop-legacy-indexes.ts` 对齐（见该脚本头部说明）。
