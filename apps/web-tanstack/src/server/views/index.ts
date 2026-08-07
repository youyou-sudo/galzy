import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import { ipPass } from "@web/lib/ip-pass";
import z from "zod";

// 记录游戏访问（热榜计数）。IP 在服务端通过 ipPass 透传（客户端无法触达
// @tanstack/react-start/server，必须放在 server function 层），供 API 按 IP 防刷。
// 限流(429)/网络失败由 elysiaErrorF 抛出，调用方（route loader）try/catch 静默忽略。
export const recordGameView = createServerFn({ method: "POST" })
	.validator(
		z.object({
			id: z.string().min(1),
		}),
	)
	.handler(async ({ data }) => {
		const { error } = await api.views.game.post({ gameId: data.id }, ipPass());
		elysiaErrorF(error);
	});

export const recordTagView = createServerFn({ method: "POST" })
	.validator(
		z.object({
			tagId: z.string().min(1),
		}),
	)
	.handler(async ({ data }) => {
		const { error } = await api.views.tag.post({ tagId: data.tagId }, ipPass());
		elysiaErrorF(error);
	});
