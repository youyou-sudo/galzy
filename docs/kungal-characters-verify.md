# Kungal 角色功能 · 终验报告

> 范围：`task-2`（后端入库 + `/characters` 模块）与 `task-3`（条目页「详情」页签）合并后的全链路验收。
> 时间：2026-11-04。验收人：api-contract-researcher（只读验收，未改动 `apps/**`）。
> 契约依据：`docs/kungal-characters-api.md`（spec 2.82.0 + 实测）。

## 0. 结论

**通过，无阻塞项。** 类型检查、单测、lint（本次改动文件）全绿；迁移只做新增；数据来源合规；幂等与事务顺序正确。

共发现 **2 条建议修（P1）**、**7 条记录即可（P2）**，无必须修（P0）。

两条 P1 在终验后由各自 owner 修复，**已于当前工作树复核通过**（见 §11）：后端补了 `unwrapJson` 读侧兜底，前端补了后台任务类型的两个字典项。

| 级别 | 数量 | 状态 |
| --- | --- | --- |
| P0 必须修 | 0 | — |
| P1 建议修 | 2 | **均已修复并复核**（§11） |
| P2 记录即可 | 7 | 见第 7 节 |

## 1. 验证命令与结果

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `bunx tsc --noEmit -p apps/api/tsconfig.json` | **exit 0**，无输出 | 基线干净 |
| `bunx tsc --noEmit -p apps/web/tsconfig.json` | **exit 0**，无输出 | 基线干净 |
| `bunx biome check <本次改动的 api 文件>` | **exit 0**，11 文件 | 仅剩 `biome.json` 的 schema 版本提示（信息级） |
| `bun run --cwd apps/api check`（全量） | exit 1 | **预存问题**，见 P2-3；不在本次改动文件内 |
| `bunx oxlint <本次改动的 web 目录>` | **0 errors / 0 warnings**，12 文件 | — |
| `bun run --cwd apps/web lint`（全量） | 1 warning | **预存**，见 P2-4 |
| `bun --cwd apps/web test --run` | **45 files / 345 tests 全通过** | 含新增 `character-list` / `character-types` / `character-dialog` |

> DB 不可达（`23.80.83.199:5434` 拒绝连接），因此 `db:up` / `db:check` **未执行**，迁移只做静态审查。这是环境限制，不是缺陷。

## 2. 迁移审查（`apps/api/drizzle/0031_jazzy_tana_nile.sql`）

**只新增，无破坏。** 文件内容仅 5 条语句：

1. `CREATE TABLE galrc_kungal_character_appearances`
2. `CREATE TABLE galrc_kungal_characters`
3. `ALTER TABLE ... ADD CONSTRAINT`（FK → characters）
4. `ALTER TABLE ... ADD CONSTRAINT`（FK → works）
5. `CREATE INDEX idx_galrc_kungal_character_appearances_work`

| 检查项 | 结论 |
| --- | --- |
| 有无 `DROP` / 改动既有表 | 无。两条 `ALTER` 都是对新表 `ADD CONSTRAINT` |
| 列类型 | `text` / `integer` / `jsonb` / `timestamp with time zone`，与 `schema/kungal.ts` 逐列一致 |
| 可空 | 仅 `id`（PK）与 `display_name` 为 NOT NULL，其余可空 —— 与「上游稀疏字段」契约相符 |
| 默认值 | 无默认值，同步侧显式写 `synced_at` |
| 外键 onDelete | 两条均 `ON DELETE cascade`：作品删 → 名册行删；角色删 → 名册行删。合理 |
| 建表顺序 | appearances 先建、characters 后建，FK 在两张表都建好后追加 → 无前向引用问题 |
| 命名 | 表名 `galrc_` 前缀、索引 `idx_galrc_` 前缀，与既有约定一致 |
| 复合主键 | `(character_id, work_id)`，同时充当「角色 × 作品」的唯一约束 |
| `_journal.json` | idx 30 → 31 连续，无跳号；`tag` 与文件名一致 |

### P2-1：FK 约束名超出 PostgreSQL 63 字节上限

| 约束 | 名称长度 |
| --- | --- |
| `galrc_kungal_character_appearances_character_id_galrc_kungal_characters_id_fk` | **77** |
| `galrc_kungal_character_appearances_work_id_galrc_kungal_works_id_fk` | **67** |

PostgreSQL 标识符上限 63 字节，超长会**静默截断**（只发 NOTICE，不报错）。两条截断后前缀不同（`..._character_id_galrc_kungal_ch` vs `..._work_id_galrc_kungal_w`），**不会撞名，能正常建表**，因此不阻塞。

风险在于：契约文件里的名字与库里的真实约束名不一致，未来写「按名 DROP CONSTRAINT」的回滚脚本会找不到对象；`db:check` 若比对约束名也可能报差异（本机无法验证）。既有迁移最长 57 字节，本次是新纪录。

建议：下次 `db:generate` 前给这两条 FK 起短名（drizzle 支持 `foreignKey({ name: 'fk_...' })`），或把表名缩短。**仅记录，不必为它回头改已生成的迁移。**

## 3. 契约一致性（API DTO ↔ 前端消费）

逐字段核对 `apps/api/src/modules/characters/service.ts` 的 `CharacterDTO` 与 `apps/web/src/components/game/characters/character-types.ts` 的 `toCharacterView`：

| DTO 字段 | 消费方式 | 结论 |
| --- | --- | --- |
| `id` / `name` / `latin` | 直接渲染 | 对齐 |
| `localized` | 后端输出扁平 `{lang: 名称}`；前端 `pickLocalized` 同时兼容 `{value,is_machine}` 与裸字符串 | 对齐（双向容错） |
| `gender` / `birthday` / `bloodType` / `heightCm` / `weightKg` | 驼峰直读，且兼容 `blood_type` 等下划线写法 | 对齐 |
| `measurements` | 后端 `{bustCm,waistCm,hipCm,cup}`；前端读 `bustCm ?? bust_cm ?? bust` 三档 | 对齐 |
| `imageUrl` / `imageWidth` / `imageHeight` / `imageThumbhash` | 前端同时回退到 `record.image.url/width/height/thumbhash` | 对齐 |
| `traits` | 后端 `{id,displayName,nameZh,isSexual,group}`；前端读 `displayName ?? display_name`、`nameZh ?? name_zh`、`isSexual ?? is_sexual` | 对齐；`group` 前端暂未消费（展示为平铺标签，不分组），不影响 |
| `rosterRole` / `spoiler` | 前端用闭集守卫（不认识的值 → null，落到「其他角色」组） | 对齐，且能容忍上游新增枚举值 |
| `appearances[]` | 后端给 `{workId, displayId, displayName, rosterRole, spoiler}`；前端取 `displayId/displayName` | 对齐（`workId` 前端未用，多余字段无害） |

两点确认：

- **null vs undefined**：后端 DTO 注释明确「上游没有的字段一律显式 null，不省略键」，前端一律 `asString()/asNumber()` 归一化（`null`、`undefined`、空串都收敛成 `null`），**不存在「键缺失才正确」的隐式耦合**。
- **`nameZh` 的来源**：后端 `traitsOf` 先读 `name_zh`（行内没有该键，实际走不到），再读 `localized['zh-Hans'].value`，最后回退 `displayName`。与契约文档 §5.5 一致，属正确的防御式写法。
- **`readCharacterList`** 按 id 去重并在无 id 时丢弃，前端不会因为名册重复渲染重复卡片。

## 4. 幂等、事务与清理

| 检查项 | 结论 |
| --- | --- |
| 批内去重（21000） | **正确**。角色行先落 `Map<id, row>`（`characterRows.set` 前 `has(id) continue`），名册行按 `${workId}:${id}` 的 `Set` 去重。同一语句里不会二次命中同一主键 |
| upsert 语义 | 两张表都 `onConflictDoUpdate`，更新列逐列列出（含 `synced_at`），重复执行结果收敛 |
| FK 顺序 | `characters` 先 insert，`appearances` 后 insert，同事务内 → 不会 23503 |
| 水合未命中兜底 | `normalizeCharacterFromRoster` 生成最小角色行，保证 appearances 的外键成立（否则整批 23503）——设计正确 |
| 名册幽灵行清理 | 按作品维度 `DELETE ... WHERE work_id = ? AND character_id NOT IN (本次保留)`，**只在同一作品内删**，不会误删其他作品的行 |
| 失败隔离 | 名册用 `Promise.allSettled`：单作品 404/超时只计数、不进 `rosters`，因此**不会因为拉取失败而触发出删除**（这是清理逻辑安全的前提） |
| 单批失败 | 仅捕获取消该批（`characterErrors`），不中断整轮；`syncCharacters` 单独入口才把整体异常收尾成 failed |
| 锁 | `kungal-sync-characters` 独立锁 + TTL 3600s，作品同步与角色同步可并行、两次角色同步互斥 |

## 5. 数据来源合规

| 检查项 | 结论 |
| --- | --- |
| 新增 vndb API 调用 | **无**。`git diff` 内新增行没有任何 `vndb-api` / `api.vndb` / `fetchVndb*` 引用 |
| vndb 的使用方式 | 仅读 `kungalWorks.vndbId` 列做作品身份映射与展示 id 生成（`displayIdOf`），不派生任何角色字段 |
| tags / 词表写入 | **无**。改动中没有对 `tags` 表的 insert/update/delete |
| traits 处理 | 原始数组进 jsonb，**不建词表、不合并 id**（schema 注释已写明理由），未触碰既有 tags 体系 |
| API 端点 | 新增 `/characters/game`、`/characters/info`（公开只读）与 `POST /kungal-sync/characters`（`isAdmin`），未改变既有路由 |

## 6. 问题清单

### P1-1（建议修 · **已修复，复核通过**）jsonb 落库/回读缺二次编码防御 —— owner：api-characters

`apps/api/src/modules/characters/service.ts` 的 `traitsOf` / `measurementsOf` / `localizedOf` 都以 `Array.isArray(raw)` / `typeof raw === 'object'` 起手，**没有** `unwrapJson` 兜底。

而同一仓库的两处证据表明「jsonb 被串化」不是假想问题：

1. `libs/kungal-api/normalize.ts` 里有专门的 `unwrapJson()`，`parseRefs` 在读取时用它兜底；
2. 同步侧对 `refs` **必须**走 `jsonbArray()`（`sql` 模板 `::text::jsonb`），注释写明「直接传数组会被 drizzle 串化 + bun 再编码成 jsonb 字符串（**历史 bug**）」。

本次 `characters` 表里 `traits` / `intros` / `localized` / `measurements` / `image` / `figure` 都是**按普通值写入**的，只有 `refs` 走了 `jsonbArray`。若「历史 bug」对数组普遍成立，这四列会存成 jsonb 字符串，回读时 `Array.isArray` 为 false → **traits 静默变 null、三围静默消失、无任何报错**，正是最难受的失败模式。

建议（二选一，前者更稳）：

- **读侧兜底**：`traitsOf` / `measurementsOf` / `localizedOf` 开头加 `const v = unwrapJson(raw)`，复用已有 helper。能一并覆盖「已经存坏的历史行」。
- **写侧对齐**：同步里对 `traits` / `intros` 也用 `jsonbArray()`，与 `refs` 保持一致。只解决新数据。

无法在本机用真实数据证伪（DB 不可达），故列为建议修而非必须修；但成本极低，建议这一轮就加。

### P1-2（建议修 · **已修复，复核通过**）后台任务类型字典缺 `kungal-characters` —— owner：web-characters

后端把新任务类型登记在 `apps/api/src/modules/tasks/model.ts`（`TYPE_LABELS` / `TYPE_PRIORITY`=P2 / `TYPE_SLA_MINUTES`=60），但 web 后台有**一份自己的字典**，没同步加：

| 文件 | 现状 | 影响 |
| --- | --- | --- |
| `apps/web/src/lib/admin/tasks/labels.ts` | `TASK_TYPE_LABELS` 无该键，`taskTypeLabel()` 回落 `?? type` | 任务列表里显示原始串 `kungal-characters` 而不是「Kungal 角色同步」 |
| `apps/web/src/lib/admin/tasks/sla.ts` | `SLA_MINUTES` 无该键，回落 `DEFAULT_SLA_MINUTES = 30` | 前端按 30 分钟算 SLA，后端声明 60 分钟 → 超时标记偏早 |

注：`labels.ts` 的注释说「未知值原样回显，便于暴露后端新增值」，所以这不算是「错误」，但既然本次就是新增类型，补两行更完整。改完不影响任何既有断言。

## 7. 其余记录项（P2）

- **P2-2 traits 只有 `spoiler=none` 一档。** 同步走 `/catalog/characters?ids=` 批量通道，该通道**没有 `spoiler` 参数**，实测默认只返回无剧透属性（同一角色 42 条 vs `spoiler=major` 的 49 条，其他角色少 20%–35%）。`schema/kungal.ts` 与 `client.ts` 已加注释说明这是刻意取舍，`docs/kungal-characters-api.md` §3.5 有完整数据。**若要补全量，需逐角色调详情端点**——建议做成独立的按需任务，不塞进主同步。
- **P2-3 全量 `bun run --cwd apps/api check` 失败（预存）。** 报错文件是 `apps/api/src/libs/identity/CONTRACT.md`（markdown 表格宽度），本次改动完全没有触碰它（`git status` 无记录）。与角色功能无关，改动前就存在。本次改动涉及的 11 个 api 文件单独跑 biome 是 **exit 0**。
- **P2-4 全仓 oxlint 1 warning（预存）。** `apps/web/src/pages/games/index.tsx` 的 `GamesPagePending` 未使用，与本次无关；本次改动目录 **0 warning**。
- **P2-5 空名册会清空该作品的名册。** `keep.length === 0` 时执行 `DELETE ... WHERE work_id = ?`，即「上游返回空名册 = 该作品确实没角色」。语义正确，且 `rosters` 只收 fulfilled（失败的作品不进清理分支）。残留风险：若上游因可见性/分级策略突然对某作品返回空名册，本地名册会被清空，下一轮同步可自愈。
- **P2-6 `lower(kungalWorks.id) = lower(?)` 用不到主键索引。** `findWork` 的 kungal-only 路径（`/kgX` 链接）对列做函数调用 → 走顺序扫描。kungal id 是十进制字符串，理论上可直接等值匹配；但该路径只服务 kungal-only 条目、量极小，暂不必改。
- **P2-7 DB 不可达导致的三项未验证**：迁移未实际应用、`db:check` 未跑、jsonb 落库形态（见 P1-1）未实机抽查。建议上线后抽查一行：`SELECT jsonb_typeof(traits), jsonb_typeof(measurements) FROM galrc_kungal_characters LIMIT 1;` 期望都是 `array` / `object`（**若出现 `string` 就证实 P1-1**）。

## 8. UI 退化检查（只读复核）

| 场景 | 实现 | 结论 |
| --- | --- | --- |
| 无角色 | `CharacterList` 在分组为空时渲染全站统一的 `EmptyState`（「暂无角色数据 / 这部作品还没有收录角色信息」） | 通过 |
| 无图 / 图加载失败 | `character-card`：有 `thumbhash` 就先铺 blur 占位；`imageUrl` 为空或 `onError` 后回落到姓名首字占位；宽高缺失用 400×533 兜底比例 | 通过 |
| 详情请求失败 | `detail.isError && !isFetching` 传入弹窗，配合 `onRetry` 调 `refetch`；加载态与错误态分离，不会互相闪烁 | 通过 |
| Esc / 遮罩关闭 | 弹窗基于全站 `ui/dialog`（base-ui `onOpenChange`），Esc 与遮罩点击都走同一回调；另有关闭按钮 | 通过 |
| 关闭后内容不闪空 | `CharactersPage` 关闭时保留 `selected`，退场动画期间内容不突变 | 通过（细节） |
| 无障碍 | 卡片是原生 `<button>`（Tab 可聚焦、Enter/Space 打开），不在按钮内嵌套链接 | 通过 |

## 9. 改动范围核对

| 预期作用域 | 实际改动 | 结论 |
| --- | --- | --- |
| 后端 schema / lib / sync / characters 模块 / 迁移 | 全部命中，且都在 `task-2` 声明的写作用域内 | 通过 |
| 前端 `pages/[id]` / `components/game` / `GameTabs` / `server/impl` / `server/game` / `registry` | 全部命中 | 通过 |
| 后端超作用域的 4 处登记（`index.ts`、`queue/{payload,types}`、`tasks/{model,service}`） | 均为**纯增量登记**：新增 `kungal-characters` 联合类型、队列白名单一项、三条字典一项、一个 `case` 分支；既有分支/类型/文案一字未改 | 通过（已向 lead 报备） |
| web `lib/cdn-cache.ts`、`hooks/use-idle-preload.ts` | 由 lead 修（详情页签正则加 `characters`、预取预算 6→7），本次只复核不报 | 通过 |

**任务类型登记完整性**：`grep -rn "kungal-delta"` 后逐一比对，新增类型在「联合类型 / 队列白名单 / 后端三张字典 / 后端分派 switch / enqueue 入口」五处齐全，**enqueue 不会被拒**。唯一缺的是前端后台的两张展示字典（P1-2）。

## 10. 验收判定

- task-4 的 8 项检查：**全部通过**（类型 / lint / 单测 / 迁移 / 契约 / 合规 / 幂等 / UI）。
- **P1 已全部处理，无 P0；P2 记录项保留。** 两条 P1 的修复内容与复核结果见 §11。
- 迁移与 jsonb 形态的实机验证需等 DB 可达后补跑，属环境限制（P2-7）。

## 11. 终验后修复记录

终验报告发出后，两条 P1 由对应 owner 修复，lead 另补了写侧防御与两处 follow-up。下面逐条记录**修复内容 + 复核结果**，本条结论均基于当前工作树（非报告初稿时的树）。

### 11.1 P1-1 读侧（owner：api-characters）

- `apps/api/src/modules/characters/service.ts`：新增模块内私有 `unwrapJson()`，`localizedOf` / `measurementsOf` / `traitsOf` 三个 reader 开头统一先 `unwrapJson(raw)` 再判断类型（`traits` 的 `Array.isArray` 改为判断解包后的值）。
- `apps/api/src/libs/kungal-api/normalize.ts` 里的同名 helper 保持**私有**（不跨模块 export，避免为了 3 行防御拉出公共依赖；两处实现逻辑一致，各自本地维护）。
- 效果：历史上「jsonb 里装 JSON 字符串」的脏行也能被读出来，不只是新写入的数据。

### 11.2 P1-1 写侧（lead 补，api-characters 落地）

- `apps/api/src/modules/kungal-sync/service.ts` 新增本地 helper：

  ```ts
  function jsonbTextOrNull(value: unknown): unknown {
    return value === null || value === undefined ? null : jsonbArray(value)
  }
  ```

- 角色表的**全部 jsonb 列**（`localized` / `measurements` / `image` / `figure` / `intros` / `traits` / `refs`）在 upsert 前统一走它，即 `JSON.stringify(x)::text::jsonb`。
- **为什么不用裸 `jsonbArray`**：`jsonbArray` 内部是 `JSON.stringify(value ?? [])`，传 `null` 会被写成 `[]` —— 把「没有这个块」错写成「空数组」，改变字段语义。`jsonbTextOrNull` 让 `null` 原样透传，保持「无值 = NULL」。
- 写侧统一之后，读侧的 `unwrapJson` 仍保留：它负责兜底**修复前已入库**的历史行。

### 11.3 P1-2（owner：web-characters）

- `apps/web/src/lib/admin/tasks/labels.ts`：`TASK_TYPE_LABELS` 补 `"kungal-characters": "Kungal 角色同步"`。
- `apps/web/src/lib/admin/tasks/sla.ts`：`SLA_MINUTES` 补 `"kungal-characters": 60`。
- 键值与后端 `modules/tasks/model.ts` 的 `TYPE_LABELS` / `TYPE_SLA_MINUTES` 逐字对齐、顺序一致，后台不再显示原始串、SLA 不再回落 30 分钟。

### 11.4 lead 补的两处 follow-up

| 文件 | 改动 | 影响 |
| --- | --- | --- |
| `apps/web/src/lib/cdn-cache.ts` | 详情页签正则加入 `characters` | `/[id]/characters` 从 `no-store` 变为可边缘缓存 300s（与其它公开页签一致）；`cdn-cache.test.ts` 同步补断言 |
| `apps/web/src/hooks/use-idle-preload.ts` | 预取预算 6 → 7，注释改为 6 个 tab | 空闲预取覆盖新增页签；仍受「整页预算」约束，不会退化成成片预取 |

### 11.5 复核结果（当前工作树，终验后重跑）

| 命令 | 结果 |
| --- | --- |
| `bunx tsc --noEmit -p apps/api/tsconfig.json` | **exit 0** |
| `bunx tsc --noEmit -p apps/web/tsconfig.json` | **exit 0** |
| `bunx biome check`（改动 api 目录，11 文件） | **0 error** |
| `bunx oxlint`（改动 web 目录，17 文件） | **0 error / 0 warning** |
| `bun --cwd apps/web test --run` | **45 files / 345 tests 全通过** |

> 复核期间 `apps/web` 的 tsc 曾短暂报 `service.ts(14,10) TS6133 'unwrapJson' is declared but its value is never read` —— 那是 api-characters 正在编辑该文件的**中间态**，重跑即干净。上表是最终树的独立复跑结果，不是中间态。

### 11.6 仍未闭合的一项

P2-7（迁移实机应用 + jsonb 落库形态）依旧因本机 DB 不可达而未验证。写侧统一走 `::text::jsonb` 后，**预期** `jsonb_typeof` 恒为 `array` / `object`；上线后跑一条即可确认：

```sql
SELECT jsonb_typeof(traits), jsonb_typeof(measurements), jsonb_typeof(localized)
FROM galrc_kungal_characters LIMIT 1;
```
