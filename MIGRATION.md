# VNDB FDW → API 迁移指南

## 前置条件

- [x] 已部署本次代码变更
- [x] PostgreSQL 实例已运行（本地 VNDB 表在 `dbSeed()` 启动时自动创建）
- [x] Redis 已运行
- [x] （可选）获取 VNDB API Token：访问 https://vndb.org/u/tokens 创建 token，写入 `.env` 的 `VNDB_API_TOKEN`

## 迁移步骤

### Step 1: 部署代码，确认启动正常

```bash
# 在服务器上拉取最新代码后启动
bun run dev   # 或 bun run build && ./server
```

启动日志应包含：
```
✅️ Website database connection test successful
✅️ Database seed completed
✅️ Redis connection test successful
🎉 Database loading complete
```

注意：旧日志中的 `✅️ VNDB database connection test successful` 和 `✅️ dbFdw connection test successful` 不再出现。

### Step 2: 确认本地 VNDB 表已创建

```sql
-- 连接主数据库，确认 11 张 VNDB 表已建
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vn','vn_titles','images','tags','tags_vn',
                     'releases','releases_vn','releases_titles',
                     'producers','releases_producers','producers_relations');
```

此时表为空，等待同步。

### Step 3: 执行首次全量同步

```bash
# 获取 galrc_alistb 中的 vid 数量
curl http://localhost:3001/vndb-sync/full -X POST
```

同步是异步的（fire-and-forget），服务端日志会输出：
```
🔄 VNDB 全量同步开始: 3000 个 VN
✅ VNDB 全量同步完成
```

**耗时估算**：以 3000 个 VN 为例，约 7 分钟（含 API 限流等待）。

### Step 4: 验证数据完整性

```sql
-- 确认 VN 数量与 galrc_alistb 去重 vid 数量一致
SELECT COUNT(*) FROM vn;
SELECT COUNT(DISTINCT vid) FROM galrc_alistb WHERE vid IS NOT NULL;

-- 抽查一条数据
SELECT * FROM vn WHERE id = 'v17';
SELECT * FROM vn_titles WHERE id = 'v17';
SELECT * FROM tags_vn WHERE vid = 'v17' LIMIT 5;
```

### Step 5: 重建 MeiliSearch 索引

```bash
# 重建主搜索索引
curl http://localhost:3001/cron/meilisearch -X POST

# 重建标签搜索索引
curl http://localhost:3001/cron/meilisearch-tag -X POST

# 验证
curl http://localhost:7700/indexes/[你的索引名]/stats
```

### Step 6: 验证前端功能

- [ ] 首页游戏列表正常加载
- [ ] 游戏详情页正常展示（标题、封面图、发布商、标签）
- [ ] 标签页面正常列表
- [ ] 标签详情页正常显示关联游戏
- [ ] 发布商页面正常显示关联游戏
- [ ] 搜索功能正常

### Step 7: 清除旧环境变量（可选）

如果迁移稳定运行一段时间后，可以从 `.env` 中删除：

```bash
# 不再需要
DEVVNDB_DATABASE_URL
VNDB_DATABASE_URL
```

---

## 增量同步

系统已内置自动增量触发：

- **Alist 扫描新条目** → 自动调用 `VndbSync.syncDelta()` 拉取新 VN 数据
- **手动触发** → `POST /vndb-sync/delta`（检测 galrc_alistb 中新增的 vid）

---

## 回滚方案

若出现严重问题需回退：

```bash
git revert <commit-hash>   # 回退代码
# 恢复 .env 中的 VNDB_DATABASE_URL / DEVVNDB_DATABASE_URL
# 重新部署，FDW 逻辑会自动重建
```
