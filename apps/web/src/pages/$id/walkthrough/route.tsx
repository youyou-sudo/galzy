import { defineRoute } from "@teyik0/furin";
import { t } from "elysia";

/**
 * `/games/[id]/walkthrough` 的段布局：攻略列表（index.tsx）与单篇攻略
 * （$walkthroughId.tsx）共用。旧实现的 `[id]/walkthrough.tsx` 是页面，迁移后
 * 页面内容放进 index.tsx，这里只保留段布局。
 */
export const route = defineRoute("/$id/walkthrough")
	.config({ mode: "ssr", params: t.Object({ id: t.String() }) })
	.layout(({ children }) => <>{children}</>);
