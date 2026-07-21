/**
 * Utility helpers for supercoder plugin.
 * Exported separately so plugin loader only sees SupercoderPlugin in supercoder.js.
 */

/**
 * Returns the short pre-generation prompt reminder text for mandatory follow-up.
 * Intentionally kept extremely short to avoid repeating main-agent.md rules.
 * This nudge is appended only for main-agent sessions, not subagents.
 * @returns {string}
 */
export const getMandatoryFollowUpReminder = () =>
  '【强制要求】每次最终回复前必须调用 question 工具，否则视为违规。';

/**
 * Parses a dotenv-format string into a plain key-value object.
 * Lines starting with # are treated as comments and ignored.
 * Blank lines are ignored. Values may contain '=' characters.
 *
 * @param {string|null|undefined} text - Raw contents of a .env file
 * @returns {Record<string, string>}
 */
export const parseDotEnv = (text) => {
  if (!text) return {};
  const result = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
};

/**
 * Returns true if the parsed env object has SUPERCODER_TDD set to the
 * exact lowercase string 'true'.
 *
 * @param {Record<string, string>|null|undefined} env - Parsed env key-value map
 * @returns {boolean}
 */
export const isTddEnabled = (env) => {
  return env?.SUPERCODER_TDD === 'true';
};

/**
 * Returns true if the parsed env object has SUPERCODER_CODE_REVIEW set to the
 * exact lowercase string 'true'.
 *
 * @param {Record<string, string>|null|undefined} env - Parsed env key-value map
 * @returns {boolean}
 */
export const isCodeReviewEnabled = (env) => {
  return env?.SUPERCODER_CODE_REVIEW === 'true';
};

/**
 * Builds a banner describing the current Supercoder configuration.
 *
 * @param {Record<string, string>|null|undefined} env - Parsed env key-value map
 * @returns {string}
 */
export const getConfigBanner = (env) => {
  const tdd = isTddEnabled(env);
  const cr = isCodeReviewEnabled(env);

  const lines = [];
  lines.push(`🔧 Supercoder 配置：TDD=${tdd ? '开启' : '关闭'}, 代码审查=${cr ? '开启' : '关闭'}`);

  if (!tdd) {
    lines.push('  TDD 已关闭：开发工程师将直接实现，跳过测试先行');
  }
  if (!cr) {
    lines.push('  代码审查已关闭：评审/质量/验收工程师不可用');
  }

  return lines.join('\n');
};

/** Prompt shown when .env config file is missing. */
export const ENV_MISSING_PROMPT = `⚠️ 未检测到 .env 配置文件。请通过以下选项配置 Supercoder：
- 运行 \`npx supercoder init\` 进行交互式配置
- 或手动创建 .env 文件，添加 SUPERCODER_TDD=true/false 和 SUPERCODER_CODE_REVIEW=true/false
当前默认：TDD=关闭, 代码审查=关闭`;

/**
 * Builds the full text to inject into the first user message for a session.
 * For main-agent sessions, appends a short pre-generation prompt reminder after
 * the wrapped prompt. For subagent sessions, no reminder is appended.
 * When env is provided (main-agent only), a config banner is also appended.
 *
 * Extracting this as a pure function makes the injection logic directly testable
 * without needing to mock the transform hook.
 *
 * @param {string} tag - XML-like tag name wrapping the prompt (e.g. 'EXTREMELY_IMPORTANT')
 * @param {string} content - The prompt content to wrap
 * @param {boolean} isSubagent - Whether the current session is a subagent
 * @param {Record<string, string>|null|undefined} [env=null] - Parsed env (only affects main-agent)
 * @param {boolean} [envMissing=false] - Whether .env file was missing
 * @returns {string}
 */
export const buildInjectedPromptText = (tag, content, isSubagent, env = null, envMissing = false) => {
  const wrapped = `<${tag}>\n${content}\n</${tag}>`;
  if (isSubagent) return wrapped;
  const base = `${wrapped}\n\n${getMandatoryFollowUpReminder()}`;
  const banner = getConfigBanner(env);
  const withBanner = `${base}\n\n${banner}`;
  if (envMissing) return `${withBanner}\n\n${ENV_MISSING_PROMPT}`;
  return withBanner;
};

/**
 * Determines whether a session is a subagent session, given async callbacks
 * for agent-mode lookup and session-API lookup.
 *
 * Failure-safe: when detection is uncertain (API unavailable or throws),
 * returns `true` (treat as subagent) to avoid injecting main-agent-only
 * behaviour into a session that may actually be a subagent.
 *
 * Caching policy (intentional):
 *   - Determinate results ('subagent' / 'primary' from getAgentMode, or a
 *     confirmed parentID check) ARE written to cache so subsequent calls skip
 *     all API round-trips.
 *   - Uncertainty results (getAgentMode throws without fetchSession available,
 *     or both getAgentMode and fetchSession throw) are intentionally NOT cached.
 *     A transient API failure must not permanently misclassify a main-agent
 *     session; the next call will retry and may resolve correctly once the API
 *     recovers.
 *   - When getAgentMode throws but fetchSession is available, the call falls
 *     through to fetchSession instead of returning immediately. This prevents
 *     a transient agents API failure from swallowing the follow-up reminder.
 *
 * @param {object} opts
 * @param {string|undefined} opts.sessionID
 * @param {() => Promise<string|undefined>} opts.getAgentMode
 *   Resolves to 'subagent' | 'primary' | undefined
 * @param {(id: string) => Promise<{parentID?: string}>} opts.fetchSession
 *   Fetches the session object; should throw or return null/undefined on failure.
 * @param {Map<string, boolean>} opts.cache
 *   Mutable cache keyed by sessionID. Only determinate results are stored here.
 * @returns {Promise<boolean>}
 */
export const resolveIsSubagentSession = async ({ sessionID, getAgentMode, fetchSession, cache }) => {
  if (sessionID !== undefined && cache.has(sessionID)) {
    return cache.get(sessionID);
  }

  try {
    const mode = await getAgentMode();
    if (mode === 'subagent') {
      if (sessionID !== undefined) cache.set(sessionID, true);
      return true;
    }
    if (mode === 'primary') {
      if (sessionID !== undefined) cache.set(sessionID, false);
      return false;
    }
  } catch {
    // getAgentMode threw (e.g. transient network error).
    // Fall through to fetchSession fallback instead of giving up immediately.
  }

  if (!fetchSession) return true; // Uncertainty: no session API available. NOT cached — see caching policy.

  try {
    const session = await fetchSession(sessionID);
    // null/undefined response is treated as uncertainty (API failure), same as throw.
    // Intentionally NOT cached — see caching policy in JSDoc above.
    if (session == null) return true;
    const isChildSession = Boolean(session.parentID);
    if (sessionID !== undefined) cache.set(sessionID, isChildSession);
    return isChildSession;
  } catch {
    // Uncertainty: fetchSession threw (e.g. transient network error).
    // Intentionally NOT cached — see caching policy in JSDoc above.
    return true;
  }
};

import crypto from 'node:crypto'
import path from 'node:path'

/**
 * 生成 worktree 路径和分支名
 * @param {string} projectDir - 项目目录的绝对路径
 * @param {string} taskId - 任务短 ID（如 'auth-api', 'fix-typo'）
 * @param {string} [suffix] - 可选的随机后缀（默认自动生成 4 位 hex）
 * @returns {{ worktreePath: string, branchName: string, suffix: string }}
 */
export function generateWorktreeInfo(projectDir, taskId, suffix) {
  if (!suffix) {
    suffix = crypto.randomBytes(2).toString('hex')
  }

  const projectName = path.basename(projectDir)
  const parentDir = path.dirname(projectDir)
  const worktreePath = path.join(parentDir, `${projectName}-wt-${taskId}-${suffix}`)
  const branchName = `wt/${taskId}-${suffix}`

  return { worktreePath, branchName, suffix }
}

/**
 * 生成 worktree 创建的 shell 命令序列
 * @param {string} worktreePath - worktree 绝对路径
 * @param {string} branchName - 分支名
 * @param {{ npmInstall?: boolean }} [options]
 * @returns {string[]} shell 命令数组
 */
export function generateWorktreeCommands(worktreePath, branchName, options = {}) {
  const cmds = [
    `git worktree add "${worktreePath}" -b "${branchName}"`
  ]
  if (options.npmInstall) {
    cmds.push(`cd "${worktreePath}" && npm install`)
  }
  return cmds
}

/**
 * 生成 worktree 清理的 shell 命令序列
 * @param {string} worktreePath - worktree 绝对路径
 * @param {string} branchName - 分支名
 * @returns {string[]} shell 命令数组
 */
export function generateWorktreeCleanupCommands(worktreePath, branchName) {
  return [
    `git worktree remove "${worktreePath}"`,
    `git branch -d "${branchName}"`,
    'git worktree prune'
  ]
}
