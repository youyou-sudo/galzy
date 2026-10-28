import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { cookiePass } from "@web/lib/cookie-pass";
import { elysiaErrorF } from "@web/lib/elysia-error";
import * as z from "zod/mini";

/**
 * 后台：广告位（Slot）+ 广告素材（Creative）管理 BFF。
 *
 * 两级模型：广告位描述「展示在哪里」（key / 同屏条数 / 手机端策略 / 轮播间隔），
 * 素材描述「展示什么」（图片 / 跳转 / 设备定向 / 权重 / 排期 / 统计）。
 * 广告位与素材各有一组 CRUD；素材排序按广告位分组（位内拖动），
 * 因此 reorder 必须带 slotId，且 ids 必须覆盖该位的全部素材。
 *
 * 缓存：公开数据（GET /adverts/slot/:key）在 API 侧按广告位缓存 60s，
 * 写操作后 API 会精确 DEL 受影响的 galzy:adverts:slot:<key>（见 API service 的
 * invalidateSlotCache；刻意不扫全库），所以这里不需要额外处理缓存，
 * 前端只负责 invalidateQueries 用服务端真值校正乐观结果。
 *
 * 返回类型：API 的 service 已把行映射成显式 DTO（时间统一为 ISO 字符串），
 * 所以这里直接透传 Eden 的结果，不做 any / 断言——契约漂移会在这里被 tsc 抓住。
 */

/* ── 与 API 对齐的枚举与校验 ───────────────────────────────── */

/** 手机端展示策略。 */
const MOBILE_MODE = z.enum(["carousel", "stack", "hidden"]);

/** 素材的设备定向。 */
const DEVICE = z.enum(["all", "desktop", "mobile"]);

/** 广告位标识：模板里写死的调用键（pattern 与 API 侧一致）。 */
const SLOT_KEY = z
	.string()
	.check(z.regex(/^[a-z][a-z0-9_]{1,63}$/), z.minLength(2), z.maxLength(64));

/** 同一轮最多展示几条（API 校验 1..4）。 */
const MAX_ITEMS = z.int().check(z.gte(1), z.lte(4));

/** 自动轮播间隔秒数（0 = 不自动切换，API 校验 0..60）。 */
const CAROUSEL_INTERVAL = z.int().check(z.gte(0), z.lte(60));

/** 权重（候选多于展示位时按它随机轮换）。 */
const WEIGHT = z.int().check(z.gte(0), z.lte(10_000));

/**
 * 备注类文本：后台备注可以清空，API 侧把空串归一化成 NULL，
 * 所以这里统一传「去空白后的字符串」，不传 null（避免 TypeBox 校验失败）。
 */
const OPTIONAL_TEXT = z.optional(z.string());

/** 排期时间：ISO 字符串；显式 null 表示清空排期（更新时才这样传）。 */
const SCHEDULE = z.optional(z.union([z.string(), z.null()]));

/* ── 广告位 ─────────────────────────────────────────────────── */

/** 广告位列表（含该位下的素材总数，用于删除前拦截）。 */
export const adminGetAdSlots = createServerFn({ method: "GET" })
	.validator(z.object({}))
	.handler(async () => {
		const { data, error } = await api.adverts.slots.get(cookiePass());
		elysiaErrorF(error);
		return data ?? [];
	});

/** 新增广告位。key 冲突由 API 返回 409。 */
export const adminCreateAdSlot = createServerFn({ method: "POST" })
	.validator(
		z.object({
			key: SLOT_KEY,
			name: z.string().check(z.minLength(1)),
			description: OPTIONAL_TEXT,
			maxItems: z.optional(MAX_ITEMS),
			mobileMode: z.optional(MOBILE_MODE),
			carouselInterval: z.optional(CAROUSEL_INTERVAL),
			enabled: z.optional(z.boolean()),
		}),
	)
	.handler(async ({ data }) => {
		const { data: created, error } = await api.adverts.slots.post(
			data,
			cookiePass(),
		);
		elysiaErrorF(error);
		return created ?? null;
	});

/** 修改广告位（部分更新，省略的字段保持原值）。 */
export const adminUpdateAdSlot = createServerFn({ method: "POST" })
	.validator(
		z.object({
			id: z.number(),
			key: z.optional(SLOT_KEY),
			name: z.optional(z.string().check(z.minLength(1))),
			description: OPTIONAL_TEXT,
			maxItems: z.optional(MAX_ITEMS),
			mobileMode: z.optional(MOBILE_MODE),
			carouselInterval: z.optional(CAROUSEL_INTERVAL),
			enabled: z.optional(z.boolean()),
		}),
	)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		const { data: updated, error } = await api.adverts
			.slots({ id: String(id) })
			.put(rest, cookiePass());
		elysiaErrorF(error);
		return updated ?? null;
	});

/** 删除广告位；该位下还有素材时 API 返回 400，前端提前拦截。 */
export const adminDeleteAdSlot = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.number() }))
	.handler(async ({ data }) => {
		const { data: res, error } = await api.adverts
			.slots({ id: String(data.id) })
			.delete(undefined, cookiePass());
		elysiaErrorF(error);
		return { success: res?.success ?? true };
	});

/* ── 广告素材 ───────────────────────────────────────────────── */

/** 全部素材（含停用 / 未开始 / 已结束），可按广告位筛选。 */
export const adminGetAdverts = createServerFn({ method: "GET" })
	.validator(z.object({ slotId: z.optional(z.number()) }))
	.handler(async ({ data }) => {
		const { data: list, error } = await api.adverts.all.get({
			// query 参数在 HTTP 层永远是字符串，API 侧再解析成整数
			query: data.slotId == null ? {} : { slotId: String(data.slotId) },
			...cookiePass(),
		});
		elysiaErrorF(error);
		return list ?? [];
	});

/** 新增素材：sortOrder 由 API 取该位 max+1（advisory lock 串行化）。 */
export const adminCreateAdvert = createServerFn({ method: "POST" })
	.validator(
		z.object({
			slotId: z.number(),
			name: z.string().check(z.minLength(1)),
			image: z.string().check(z.minLength(1)),
			href: z.string().check(z.minLength(1)),
			description: OPTIONAL_TEXT,
			enabled: z.optional(z.boolean()),
			device: z.optional(DEVICE),
			weight: z.optional(WEIGHT),
			startAt: z.optional(z.string()),
			endAt: z.optional(z.string()),
		}),
	)
	.handler(async ({ data }) => {
		const { data: created, error } = await api.adverts.post(data, cookiePass());
		elysiaErrorF(error);
		return created ?? null;
	});

/**
 * 修改素材（部分更新）。
 *
 * startAt / endAt 允许显式传 null 表示清空排期——只传一侧时由 API
 * 拿另一侧的现有值比较先后顺序，前端这里也做同样的校验以便即时报错。
 */
export const adminUpdateAdvert = createServerFn({ method: "POST" })
	.validator(
		z.object({
			id: z.number(),
			// 素材归属的广告位创建后不可变更：API 的更新接口不接受 slotId
			name: z.optional(z.string().check(z.minLength(1))),
			image: z.optional(z.string().check(z.minLength(1))),
			href: z.optional(z.string().check(z.minLength(1))),
			description: OPTIONAL_TEXT,
			enabled: z.optional(z.boolean()),
			device: z.optional(DEVICE),
			weight: z.optional(WEIGHT),
			startAt: SCHEDULE,
			endAt: SCHEDULE,
		}),
	)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		const { data: updated, error } = await api
			.adverts({ id: String(id) })
			.put(rest, cookiePass());
		elysiaErrorF(error);
		return updated ?? null;
	});

/** 删除素材。 */
export const adminDeleteAdvert = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.number() }))
	.handler(async ({ data }) => {
		const { data: res, error } = await api
			.adverts({ id: String(data.id) })
			.delete(undefined, cookiePass());
		elysiaErrorF(error);
		return { success: res?.success ?? true };
	});

/**
 * 位内拖动排序：ids 数组下标即该位的 sortOrder。
 * API 会校验 ids 集合等于该广告位现有素材且无重复。
 */
export const adminReorderAdverts = createServerFn({ method: "POST" })
	.validator(z.object({ slotId: z.number(), ids: z.array(z.number()) }))
	.handler(async ({ data }) => {
		const { data: res, error } = await api.adverts.reorder.put(
			{ slotId: data.slotId, ids: data.ids },
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: res?.success ?? true };
	});
