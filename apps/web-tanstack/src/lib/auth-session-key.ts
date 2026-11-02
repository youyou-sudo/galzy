/**
 * 会话在 React Query 里的 key。
 *
 * 独立成模块（而不是放在 `use-auth-session.ts`）：根布局 `pages/root.tsx` 要在
 * 服务端/客户端都能引用这个常量，但 `use-auth-session.ts` 带 `"use client"`
 * 并依赖浏览器 auth client，不应被根布局的 SSR 图拉进来。
 */
export const AUTH_QUERY_KEY = ["auth"] as const;
