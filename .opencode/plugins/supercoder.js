/**
 * Supercoder plugin for OpenCode.ai
 *
 * Injects role prompts into model input via experimental.chat.messages.transform:
 *   - Primary/all agent sessions → .opencode/prompts/main-agent.md
 *   - Subagent sessions          → .opencode/prompts/subagent.md
 *
 * The injection is transient: it prepends to the first user message in the
 * transformed model history without mutating persisted chat history.
 * For main-agent sessions a short pre-generation prompt reminder is appended
 * to nudge the model to call the question tool (prompt-only constraint).
 *
 * Auto-registers skills directory via config hook (no symlinks needed).
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { buildInjectedPromptText, resolveIsSubagentSession, parseDotEnv, isTddEnabled, isCodeReviewEnabled, ENV_MISSING_PROMPT } from '../lib/supercoder-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_AGENT_TAG = 'EXTREMELY_IMPORTANT';
const SUBAGENT_TAG = 'SUBAGENT_RULES';

const KNOWN_PROMPT_TAGS = [`<${MAIN_AGENT_TAG}>`, `<${SUBAGENT_TAG}>`];

const getFirstUserMessage = (messages) => {
  for (const message of messages) {
    if (message.info?.role === 'user') return message;
  }
  return null;
};

const getLastUserMessage = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.info?.role === 'user') return message;
  }
  return null;
};

const isInjectedPromptPart = (part) => {
  return part?.type === 'text' && KNOWN_PROMPT_TAGS.some((tag) => part.text.includes(tag));
};

const CODE_REVIEW_BLOCKED_AGENTS = ['评审工程师', '质量工程师', '验收工程师'];

export const SupercoderPlugin = async ({ client }, {
  _envFilePath,
} = {}) => {
  const skillsDir = path.resolve(__dirname, '../skills');
  const promptsDir = path.resolve(__dirname, '../prompts');

  // Read project-root .env to detect SUPERCODER_TDD and SUPERCODER_CODE_REVIEW.
  // _envFilePath is an optional override used only in tests; production code
  // always falls through to process.cwd()/.env.
  const projectEnvPath = _envFilePath ?? path.join(process.cwd(), '.env');
  let env = null;
  let envMissing = false;
  try {
    if (fs.existsSync(projectEnvPath)) {
      const envText = fs.readFileSync(projectEnvPath, 'utf8');
      env = parseDotEnv(envText);
    } else {
      envMissing = true;
    }
  } catch {
    // If .env read fails, proceed with env=null
  }

  // Lazily read and cache prompt files
  let mainAgentPrompt = null;
  let subagentPrompt = null;
  let agentModes = null;
  const subagentSessionCache = new Map();

  const getMainAgentPrompt = () => {
    if (mainAgentPrompt !== null) return mainAgentPrompt;
    const promptPath = path.join(promptsDir, 'main-agent.md');
    if (!fs.existsSync(promptPath)) return null;
    mainAgentPrompt = fs.readFileSync(promptPath, 'utf8');
    return mainAgentPrompt;
  };

  const getSubagentPrompt = () => {
    if (subagentPrompt !== null) return subagentPrompt;
    const promptPath = path.join(promptsDir, 'subagent.md');
    if (!fs.existsSync(promptPath)) return null;
    subagentPrompt = fs.readFileSync(promptPath, 'utf8');
    return subagentPrompt;
  };

  const loadAgentModes = async (forceRefresh = false) => {
    if (agentModes !== null && !forceRefresh) return agentModes;
    if (!client?.app?.agents) {
      agentModes = agentModes || new Map();
      return agentModes;
    }

    try {
      const response = await client.app.agents();
      const data = Array.isArray(response?.data) ? response.data : response;
      agentModes = new Map(
        (Array.isArray(data) ? data : []).map((agent) => [agent.name, agent.mode])
      );
    } catch {
      agentModes = agentModes || new Map();
    }

    return agentModes;
  };

  const getAgentMode = async (agentName) => {
    if (!agentName) return undefined;

    let modes = await loadAgentModes();
    let mode = modes.get(agentName);
    if (mode) return mode;

    modes = await loadAgentModes(true);
    mode = modes.get(agentName);
    return mode;
  };

  const isSubagentSession = async (sessionID, agentName) => {
    return resolveIsSubagentSession({
      sessionID,
      getAgentMode: () => getAgentMode(agentName),
      fetchSession: client?.session?.get
        ? async (id) => {
            const response = await client.session.get({ path: { id } });
            return response?.data ?? response;
          }
        : null,
      cache: subagentSessionCache,
    });
  };

  return {
    // Inject skills path into live config so OpenCode discovers skills
    // without requiring manual symlinks or config file edits.
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
      // Code review disabled: hard-block reviewer agents so the runtime never exposes them.
      if (!isCodeReviewEnabled(env) && config.agent) {
        for (const name of CODE_REVIEW_BLOCKED_AGENTS) {
          delete config.agent[name];
        }
      }
    },

    // Enforce skill blocks based on feature flags.
    'tool.execute.before': async (input, { args } = {}) => {
      const toolName = input?.tool;
      if (toolName !== 'skill') return;

      const rawName = args?.name;
      // Normalize: strip optional `supercoder:` namespace prefix before comparing
      const skillName = typeof rawName === 'string' && rawName.startsWith('supercoder:')
        ? rawName.slice('supercoder:'.length)
        : rawName;

      if (!isTddEnabled(env) && skillName === '测试驱动开发') {
        throw new Error(
          '[TDD 已关闭] 测试驱动开发 skill 已被硬屏蔽。SUPERCODER_TDD=true 时才可使用 TDD 流程。',
        );
      }
      if (!isCodeReviewEnabled(env) && skillName === '请求代码审查') {
        throw new Error(
          '[代码审查已关闭] 请求代码审查 skill 已被硬屏蔽。SUPERCODER_CODE_REVIEW=true 时才可使用代码审查流程。',
        );
      }
    },

    // Inject role prompts into the first user message in the transformed model
    // history. This keeps the prompt hidden from persisted chat history while
    // ensuring it only appears once in the conversation context.
    'experimental.chat.messages.transform': async (_input, output) => {
      if (!output?.messages?.length) return;

      const firstUser = getFirstUserMessage(output.messages);
      const currentUser = getLastUserMessage(output.messages);
      if (!firstUser || !currentUser) return;

      const isSubagent = await isSubagentSession(currentUser.info.sessionID, currentUser.info.agent);
      const tag = isSubagent ? SUBAGENT_TAG : MAIN_AGENT_TAG;
      const content = isSubagent ? getSubagentPrompt() : getMainAgentPrompt();
      if (!content) return;

      // buildInjectedPromptText appends a short pre-generation prompt reminder for
      // main-agent sessions, and omits it for subagents. See supercoder-utils.js.
      const desiredText = buildInjectedPromptText(tag, content, isSubagent, env, envMissing);
      const existingPromptPart = firstUser.parts.find(isInjectedPromptPart);
      if (existingPromptPart) {
        existingPromptPart.text = desiredText;
        return;
      }

      const ref = firstUser.parts[0] || currentUser.parts[0];
      if (!ref) return;

      firstUser.parts.unshift({
        id: ref.id,
        messageID: ref.messageID,
        sessionID: ref.sessionID,
        type: 'text',
        text: desiredText,
      });
    },
  };
};
