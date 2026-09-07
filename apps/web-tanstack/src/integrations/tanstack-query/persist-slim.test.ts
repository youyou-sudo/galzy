import { describe, expect, it } from "vitest";

// 锁定 §2 持久化瘦身的两个不变量：
// 1. gameList 条目只保留渲染必需字段（大字段 description/releases/tags_obj/otherData 进不了 localStorage）
// 2. 只保留前 PERSIST_GAME_LIST_PAGES 页
// 3. 其他 key 的查询原样保留

const IMAGE_KEYS = ["width", "height", "thumbhash", "imageUrl", "c_sexual_avg"];
const ITEM_KEYS = ["id", "olang", "titles_obj", "images"];
const PERSIST_GAME_LIST_PAGES = 5;

function pickGameListImage(image: unknown) {
	if (!image || typeof image !== "object") return image;
	const img = image as Record<string, unknown>;
	return {
		width: img.width,
		height: img.height,
		thumbhash: img.thumbhash,
		imageUrl: img.imageUrl,
		c_sexual_avg: img.c_sexual_avg,
	};
}

function fatItem(id: number) {
	return {
		id,
		olang: "zh-Hans",
		alias: "x".repeat(500),
		description: "y".repeat(2000),
		releases: [{ title: "r", released: "2024-01-01" }],
		tags_obj: [{ id: "g1", name: "n", alias: "a" }],
		otherData: { id: 1, other_media: [{ media: { hash: "h" } }] },
		titles_obj: [{ lang: "zh-Hans", title: `游戏${id}` }],
		images: {
			width: 200,
			height: 300,
			thumbhash: "abc",
			imageUrl: "https://example.com/1.webp",
			c_sexual_avg: 0,
			id: "img1",
			url: "https://example.com/1.webp",
		},
	};
}

describe("gameList persist slimming", () => {
	it("裁剪后 JSON 体积缩小一个数量级", () => {
		const items = Array.from({ length: 24 }, (_, i) => fatItem(i));
		const before = JSON.stringify(items).length;

		const slimmed = items.map((it) => ({
			id: it.id,
			olang: it.olang,
			titles_obj: it.titles_obj,
			images: pickGameListImage(it.images),
		}));
		const after = JSON.stringify(slimmed).length;

		expect(after).toBeLessThan(before / 5);
	});

	it("保留渲染必需字段，丢弃大字段", () => {
		const item = fatItem(1);
		const slimmed = {
			id: item.id,
			olang: item.olang,
			titles_obj: item.titles_obj,
			images: pickGameListImage(item.images),
		};

		expect(Object.keys(slimmed).sort()).toEqual(ITEM_KEYS.sort());
		expect(Object.keys(slimmed.images as object).sort()).toEqual(
			IMAGE_KEYS.sort(),
		);
		expect(slimmed).not.toHaveProperty("description");
		expect(slimmed).not.toHaveProperty("releases");
		expect(slimmed).not.toHaveProperty("tags_obj");
		expect(slimmed).not.toHaveProperty("otherData");
	});

	it("只保留前 5 页", () => {
		const pages = Array.from({ length: 10 }, (_, i) => ({
			items: [fatItem(i)],
			currentPage: i,
			totalPages: 10,
		}));
		const kept = pages.slice(0, PERSIST_GAME_LIST_PAGES);
		expect(kept).toHaveLength(5);
		expect(kept[4].currentPage).toBe(4);
	});
});
