---
name: 请求代码审查
description: 当 SUPERCODER_CODE_REVIEW=true 时，完成任务、实施主要功能或在合并之前使用，以验证工作符合要求；SUPERCODER_CODE_REVIEW=false 时跳过
---

# 请求代码审查

派遣 `@评审工程师` 子代理进行代码审查，在问题级联之前发现它们。审核者获得精确制作的评估上下文——永远不是你的会话历史。这让审核者专注于工作成果，而不是你的思维过程，并为你自己保留继续工作的上下文。

**核心原则：** 早审核，常审核。

## ⚡ 跳过审查（SUPERCODER_CODE_REVIEW=false）

如果项目根目录的 `.env` 中存在 `SUPERCODER_CODE_REVIEW=false`，**跳过本 skill 的全部内容**：

- 不调度 `@评审工程师`
- 不等待代码审查结果
- 直接执行完成开发分支步骤

**只有用户明确要求或将 `SUPERCODER_CODE_REVIEW` 设为 `true` 后，才使用下方的正常审查流程。**

---

## 何时请求审核（SUPERCODER_CODE_REVIEW=true）

**强制：**
- 子代理协调中的每个任务之后
- 主要功能完成后
- 合并到 main 之前

**可选但有价值：**
- 当卡住时（新鲜视角）
- 重构之前（基线检查）
- 修复复杂 bug 后

## 如何请求

**1. 获取 git SHAs：**
```powershell
$BASE_SHA = git rev-parse HEAD~1  # 或者 origin/main
$HEAD_SHA = git rev-parse HEAD
```

**2. 派遣 @评审工程师 子代理：**

在 OpenCode 中，用 `@评审工程师` 启动审查会话，并提供以下上下文：

- **已实现的内容** — 你刚刚构建的
- **需求/计划** — 它应该做什么（功能文档或任务描述）
- **Base SHA** — 起始提交
- **Head SHA** — 结束提交
- **简要描述** — 1-2 句话总结

`@评审工程师` 子代理内置了完整的审查清单和输出格式，你只需提供上下文即可。

**3. 处理反馈：**
- 立即修复 Critical 问题
- 在继续之前修复 Important 问题
- 记录 Minor 问题以便稍后
- 如果审核者错了（带推理）反驳

## 示例

```
[刚刚完成任务 2：添加验证函数]

$BASE_SHA = git rev-parse HEAD~1
$HEAD_SHA = git rev-parse HEAD

@评审工程师
  已实现的内容：会话索引的验证和修复函数
  计划/需求：来自 docs/功能类别/功能名/README.md 的任务 2
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  描述：添加 verifyIndex() 和 repairIndex()，处理 4 种问题类型

[Subagent 返回]：
  优点：架构清晰，有真实测试
  问题：
    Important: 缺少进度指示器
    Minor: 魔法数字 (100) 用于报告间隔
  评估：可以继续

[修复进度指示器]
[继续到任务 3]
```

## 与工作流的集成

**子代理协调：**
- 每个任务后审核
- 在问题级联之前发现它们
- 继续下一个任务之前修复

**按计划执行：**
- 每个批次（3 个任务）后审核
- 获取反馈，应用，继续

**临时开发：**
- 合并前审核
- 卡住时审核

## 红线（SUPERCODER_CODE_REVIEW=true）

**永远不要：**
- 因为"简单"而跳过审核
- 忽略 Critical 问题
- 在未修复 Important 问题的情况下继续
- 与有效的技术反馈争辩

**如果审核者错了：**
- 用技术推理反驳
- 展示证明其工作的代码/测试
- 请求澄清

