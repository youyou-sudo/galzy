import { defineRoute } from "@teyik0/furin";
import { t } from "elysia";

/**
 * `/topics/[topicId]` 的段布局：详情页（index.tsx）与编辑页（edit.tsx）共用。
 *
 * furin 0.9 的 TanStack 文件路由里，带子路由的文件必须是布局；旧实现的
 * `[topicId].tsx` 同时是页面，迁移后页面内容放进 index.tsx，这里只保留段布局。
 */
export const route = defineRoute("/topics/$topicId")
	.config({ mode: "ssr", params: t.Object({ topicId: t.String() }) })
	.layout(({ children }) => <>{children}</>);
