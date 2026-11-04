import { describe, expect, it } from "vitest";
import {
	formatBirthday,
	formatBloodType,
	formatGender,
	formatMeasurements,
	groupCharacters,
	readCharacterList,
	roleLabelOf,
	spoilerLabelOf,
	toCharacterInfoView,
	toCharacterView,
} from "./character-types";

describe("角色展示格式化", () => {
	it("生日只保留月日，输出中文", () => {
		expect(formatBirthday("03-14")).toBe("3月14日");
		expect(formatBirthday("12-01")).toBe("12月1日");
		expect(formatBirthday(null)).toBeNull();
		// 非法月份原样返回，不做猜测
		expect(formatBirthday("13-40")).toBe("13-40");
	});

	it("血型统一大写，缺失为 null", () => {
		expect(formatBloodType("ab")).toBe("AB");
		expect(formatBloodType(null)).toBeNull();
	});

	it("性别映射成中文，未收录取值原样返回", () => {
		expect(formatGender("female")).toBe("女");
		expect(formatGender("male")).toBe("男");
		expect(formatGender("other")).toBe("其他");
		expect(formatGender("???")).toBe("???");
		expect(formatGender(null)).toBeNull();
	});

	it("三围用 B/W/H 拼装，全空返回 null", () => {
		expect(
			formatMeasurements({ bustCm: 88, waistCm: 58, hipCm: 86, cup: "C" }),
		).toBe("B88 / W58 / H86（C）");
		expect(formatMeasurements({ bustCm: 88 })).toBe("B88");
		expect(formatMeasurements({ cup: "D" })).toBe("D");
		expect(formatMeasurements(null)).toBeNull();
	});

	it("身份与剧透徽章文案", () => {
		expect(roleLabelOf("main")).toBe("主要角色");
		expect(roleLabelOf(null)).toBe("");
		expect(spoilerLabelOf("minor")).toBe("剧透");
		expect(spoilerLabelOf("none")).toBe("");
		expect(spoilerLabelOf(null)).toBe("");
	});
});

describe("DTO 归一化", () => {
	it("吃 camelCase 与 snake_case 两套字段名", () => {
		const view = toCharacterView({
			id: "123",
			name: "遠野 秋葉",
			latin: "Tohno Akiha",
			gender: "female",
			birthday: "09-22",
			blood_type: "ab",
			height_cm: 160,
			weight_kg: 43,
			measurements: { bust_cm: 88, waist_cm: 58, hip_cm: 86, cup: "C" },
			roster_role: "main",
			spoiler: "minor",
			imageUrl: "https://example.com/a.webp",
			image_width: 400,
			image_height: 533,
			traits: [{ id: "1", display_name: "傲娇", is_sexual: false }],
		});
		expect(view).toMatchObject({
			id: "123",
			name: "遠野 秋葉",
			latin: "Tohno Akiha",
			gender: "female",
			birthday: "09-22",
			bloodType: "ab",
			heightCm: 160,
			weightKg: 43,
			rosterRole: "main",
			spoiler: "minor",
			imageWidth: 400,
			imageHeight: 533,
		});
		expect(view?.measurements).toEqual({
			bustCm: 88,
			waistCm: 58,
			hipCm: 86,
			cup: "C",
		});
		expect(view?.traits).toEqual([
			{ id: "1", displayName: "傲娇", nameZh: null, isSexual: false },
		]);
	});

	it("有 localized 但没有 name 时回退到中文名", () => {
		const view = toCharacterView({
			id: "9",
			localized: { "zh-Hans": "两仪式", ja: "両儀式" },
		});
		expect(view?.name).toBe("两仪式");
	});

	it("无图片字段时 imageUrl 为 null（UI 走首字占位）", () => {
		const view = toCharacterView({ id: "5", name: "无图角色" });
		expect(view?.imageUrl).toBeNull();
	});

	it("缺 id 的行直接丢弃，重复 id 只保留一条", () => {
		const list = readCharacterList({
			gameId: "v17",
			workId: "123",
			characters: [
				{ id: "1", name: "A" },
				{ name: "没有 id" },
				{ id: "1", name: "A 重复" },
				{ id: "2", name: "B" },
			],
		});
		expect(list.map((item) => item.id)).toEqual(["1", "2"]);
	});

	it("详情在名册字段上补齐出演作品", () => {
		const info = toCharacterInfoView({
			id: "1",
			name: "A",
			appearances: [
				{
					workId: "17",
					displayId: "v17",
					displayName: "月姬",
					rosterRole: "main",
					spoiler: "none",
				},
				{ displayName: "缺 displayId 的行" },
			],
		});
		expect(info?.appearances).toEqual([
			{
				displayId: "v17",
				displayName: "月姬",
				rosterRole: "main",
				spoiler: "none",
			},
		]);
	});
});

describe("分组", () => {
	it("按 主要/次要/登场/其他 顺序输出，空组不出现", () => {
		const list = readCharacterList({
			characters: [
				{ id: "1", name: "A", rosterRole: "appears" },
				{ id: "2", name: "B", rosterRole: "main" },
				{ id: "3", name: "C", rosterRole: "unknown" },
				{ id: "4", name: "D", rosterRole: "main" },
			],
		});
		const groups = groupCharacters(list);
		expect(groups.map((group) => group.label)).toEqual([
			"主要角色",
			"登场角色",
			"其他角色",
		]);
		expect(groups[0]?.characters.map((item) => item.id)).toEqual(["2", "4"]);
	});
});
