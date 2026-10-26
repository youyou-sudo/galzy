import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib/elysia-error";
import type { StripUnknown } from "@web/lib/serializable";
import * as z from "zod/mini";

/**
 * 公开：前台友情链接列表（按 sortOrder 升序，由 API 排序）。
 *
 * 无入参也显式挂空对象校验——与仓库「所有 server fn 都带 validator」的约定一致
 * （调用方写 getFriendLinks({ data: {} })）。返回类型走 StripUnknown，
 * 不再用 `as unknown as FriendLink[]` 绕过 Eden 推断。
 */
export const getFriendLinks = createServerFn({ method: "GET" })
	.validator(z.object({}))
	.handler(async () => {
		const { data, error } = await api["friend-links"].get();
		elysiaErrorF(error);
		return (data ?? []) as unknown as StripUnknown<NonNullable<typeof data>>;
	});
