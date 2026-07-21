# 纵深防御验证

## 概述

当你修复由无效数据引起的 bug 时，在一个地方添加验证感觉足够了。但那个单一检查可能被不同的代码路径、重构或 mock 绕过。

**核心原则：** 在数据经过的每一层进行验证。使 bug 在结构上不可能发生。

## 为什么需要多层

单一验证："我们修复了 bug"
多层："我们使 bug 不可能发生"

不同的层捕获不同的情况：
- 入口验证捕获大多数 bug
- 业务逻辑捕获边缘情况
- 环境守卫防止特定上下文的危险
- 调试日志在其他层失败时提供帮助

## 四个层

### 层 1：入口点验证
**目的：** 在 API 边界拒绝明显无效的输入

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // ... 继续
}
```

### 层 2：业务逻辑验证
**目的：** 确保数据对此操作有意义

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... 继续
}
```

### 层 3：环境守卫
**目的：** 防止特定上下文中的危险操作

```typescript
async function gitInit(directory: string) {
  // 在测试中，拒绝在临时目录之外进行 git init
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
  // ... 继续
}
```

### 层 4：调试检测
**目的：** 捕获取证上下文

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... 继续
}
```

## 应用此模式

当你发现 bug 时：

1. **追踪数据流** — 坏值从哪里来？在哪里使用？
2. **映射所有检查点** — 列出数据经过的每个点
3. **在每一层添加验证** — 入口、业务、环境、调试
4. **测试每一层** — 尝试绕过层 1，验证层 2 捕获它

## 来自会话的示例

Bug：空的 `projectDir` 导致在源代码中执行 `git init`

**数据流：**
1. 测试设置 → 空字符串
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init` 在 `process.cwd()` 中运行

**添加的四个层：**
- 层 1：`Project.create()` 验证非空/存在/可写
- 层 2：`WorkspaceManager` 验证 projectDir 非空
- 层 3：`WorktreeManager` 在测试中拒绝在 tmpdir 之外 git init
- 层 4：git init 之前的堆栈跟踪日志

**结果：** 所有 1847 个测试通过，bug 无法复现

## 关键洞察

所有四层都是必要的。在测试期间，每一层都捕获了其他层遗漏的 bug：
- 不同的代码路径绕过了入口验证
- Mock 绕过了业务逻辑检查
- 不同平台上的边缘情况需要环境守卫
- 调试日志识别了结构滥用

**不要在一个验证点停止。** 在每一层添加检查。
