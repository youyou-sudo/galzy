---
name: 网络调研
description: 当主代理需要调研网络话题、找当前社区讨论、观点或近期进展时使用（需要浏览器渲染内容）—— 不适用于包选型（用探索现有方案），不适用于特定已知 URL（直接用 @爬虫工程师）。典型触发词："大家怎么看"、"有什么讨论"、"最近有什么进展"。
---

# 网络调研

## 概述

本 skill 是网页研究场景的触发入口。主代理通过派遣 `@网页研究编排` 将多轮搜索-筛选-归纳的研究循环委托给网页研究编排子代理，自身只负责调度执行（构造搜索 URL → 派遣 `@爬虫工程师` → 将结果传回）。

**主代理不再自行筛选链接、综合输出。** 这些语义判断全部由 `@网页研究编排` 承担。

## 三分流路由规则（使用本 skill 前先确认场景）

| 场景 | 路由 |
|------|------|
| "有没有现成的 X 库？" / 选型比较 | `探索现有方案` skill → `@调研工程师 mode=solution_exploration` |
| "帮我读这个具体 URL" / 已知 URL | 直接派遣 `@爬虫工程师`，不需要研究层 |
| "大家怎么看 X？现在讨论是什么？近期进展？" | **本 skill** → `@网页研究编排` |

路由判断由主代理显式决定，不做自动关键词匹配。

## 研究循环流程

```
第一轮：
  主代理 → @网页研究编排（传入 research_task，iteration=0）
         ← 返回 search_queries（要执行的搜索词列表）

主代理执行搜索：
  对每个 search_query，构造 Google 搜索 URL → 派遣 @爬虫工程师
  收集返回的候选 URL 列表（candidate_urls）

后续轮次（iteration+1）：
  主代理 → @网页研究编排（传入 candidate_urls + crawl_results + visited_urls）
         ← 返回 pending_urls（筛选后待采集列表）或 status=done

主代理采集 pending_urls：
  对每个 pending_url 派遣 @爬虫工程师，返回结构化内容（crawl_results）

重复，直到 status=done 或达到 max_iterations（强制终止）
```

## 主代理职责（在研究循环中）

- 维护跨轮次状态：`iteration` 计数器、`visited_urls` 列表、`crawl_results` 列表
- 将 `search_queries` 转化为实际搜索请求：构造 Google 搜索 URL → 派遣 `@爬虫工程师`
- 将爬虫结果（candidate_urls 或 crawl_results）传回 `@网页研究编排`
- **强制终止**：当 `iteration >= max_iterations` 时，即使网页研究编排返回 `need_more_data`，也必须停止循环，基于当前 `evidence_summary` 和 `conclusion` 组织最终输出
- 建议 `max_iterations` 设为 3（默认），复杂任务可提升到 5

## 主代理不做的事（已下放给网页研究编排）

- ~~分析搜索结果，提取标题/URL/摘要~~ → 网页研究编排负责
- ~~筛选 2-3 个相关链接~~ → 网页研究编排通过 `pending_urls` 输出
- ~~综合多页面内容，输出最终答案~~ → 网页研究编排通过 `conclusion` 输出

## 搜索引擎执行

**当前实测可用搜索引擎（2026-04-18）：**

| 搜索引擎 | 状态 | 备注 |
|----------|------|------|
| Google | ✅ 可用 | 主要选择；需 `--ignore-http-errors` |
| Bing | ❌ CAPTCHA | headless 浏览器直接被验证码拦截 |
| Baidu | ❌ 不可达 | `ERR_NETWORK_IO_SUSPENDED` |

构造 Google 搜索 URL 后，通过 `@爬虫工程师` 派遣采集（主代理不直接调用 browse.js）。

## 最终回复契约（主代理必须遵循）

研究循环结束后，主代理负责把 `@网页研究编排` 的输出组织成对用户可见的最终回复。以下是各字段的使用规则：

| 字段 | 用途 | 是否直接给用户 |
|------|------|----------------|
| `conclusion` | **最终回复主干**，必须作为回复的核心内容。**唯一约束：始终非 null（always non-null）string——无论 status 为何（done / need_more_data / max_iterations 截断），都必须提供可用户消费的 best-effort 结论。** | ✅ 是（必须） |
| `evidence_summary` | 支撑摘要，可作为"依据来源"补充展示 | ✅ 是（可选展示） |
| `confidence` | **唯一表示为 numeric 0-1（浮点数）**，用于调节语气（高把握→肯定语气，低把握→保留语气），不直接原样粘贴给用户。高/中/低是基于阈值的派生分桶/语气映射，不是独立协议字段。 | ❌ 不直接外显 |
| `reasoning` | 内部控制字段，主代理用于理解推理过程，不暴露给用户 | ❌ 仅内部使用 |

### `status=done` 时

直接以 `conclusion` 为核心组织回复，按需补充 `evidence_summary` 作为来源说明。

### `status=need_more_data` 但达到 `max_iterations` 强制截断时

**主代理不得以"数据不足"为由拒绝回复或无限等待。** 必须：
1. 基于当前 `evidence_summary` 和 `conclusion` 给出**暂时结论**
2. 在回复中注明"基于已收集的证据，当前判断为……"或类似措辞，体现研究仍有局限
3. 禁止直接把 `reasoning` 字段原样粘贴给用户

**示例语气模板（根据 `confidence` 高低调整，阈值：高 ≥0.8，中 ≥0.4，低 <0.4）：**
- `confidence` 高：直接陈述结论，附来源摘要
- `confidence` 中：用"目前看来……"、"根据已收集的资料……"等措辞
- `confidence` 低：用"初步迹象显示……"、"证据尚不充分，但倾向于……"等保留性措辞

## 常见错误

| 错误 | 修复 |
|------|------|
| 主代理自己筛选链接并综合输出 | 把筛选和归纳全部委托给 `@网页研究编排` |
| 不传 visited_urls，导致重复采集 | 每轮必须维护并传入 `visited_urls` |
| 忘记强制终止循环 | 必须检查 `iteration >= max_iterations`，硬性截断 |
| 直接 @调研工程师 mode=web_research 而不走 @网页研究编排 | web_research 正式入口已统一为 @网页研究编排，@调研工程师 只做 solution_exploration |
| Google 不可用时卡死 | 暂无可靠 fallback；上报调研受阻，建议用户提供具体 URL 改用 @爬虫工程师 直接访问 |
