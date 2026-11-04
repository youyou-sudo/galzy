import { describe, expect, it } from "vitest";
import {
	KUNGAL_STAGE_LABELS,
	KUNGAL_TYPE_LABELS,
	kungalProgressPercent,
	kungalStageLabel,
	kungalTypeLabel,
} from "./kungal-sync-labels";

describe("kungal 同步面板映射", () => {
	it("阶段文案覆盖 API 的全部 stage 取值", () => {
		// 与 apps/api/src/modules/kungal-sync/service.ts 的 KungalSyncProgress['stage'] 对齐
		expect(Object.keys(KUNGAL_STAGE_LABELS).sort()).toEqual([
			"cache",
			"characters",
			"resolve",
			"walkthroughs",
			"works",
		]);
	});

	it("任务类型文案覆盖全部 kungal-* 任务", () => {
		expect(Object.keys(KUNGAL_TYPE_LABELS).sort()).toEqual([
			"characters",
			"delta",
			"full",
			"walkthroughs",
		]);
	});

	it("未知取值原样回显，空值返回 null", () => {
		expect(kungalStageLabel("works")).toBe("同步作品");
		expect(kungalStageLabel("future_stage")).toBe("future_stage");
		expect(kungalStageLabel(null)).toBeNull();
		expect(kungalTypeLabel("walkthroughs")).toBe("攻略同步");
		expect(kungalTypeLabel("future_type")).toBe("future_type");
		expect(kungalTypeLabel(undefined)).toBeNull();
	});
});

describe("kungalProgressPercent", () => {
	it("没有进度时为 0", () => {
		expect(kungalProgressPercent(null)).toBe(0);
		expect(kungalProgressPercent(undefined)).toBe(0);
	});

	it("已完成恒为 100（即使 total 为 0）", () => {
		expect(
			kungalProgressPercent({
				status: "completed",
				totalItems: 0,
				processedItems: 0,
			}),
		).toBe(100);
	});

	it("闲置且没有总数时为 0，避免除零", () => {
		expect(
			kungalProgressPercent({
				status: "idle",
				totalItems: 0,
				processedItems: 0,
			}),
		).toBe(0);
	});

	it("按已处理/总数取整，并夹在 0-100", () => {
		expect(
			kungalProgressPercent({
				status: "running",
				totalItems: 300,
				processedItems: 100,
			}),
		).toBe(33);
		expect(
			kungalProgressPercent({
				status: "running",
				totalItems: 10,
				processedItems: 20,
			}),
		).toBe(100);
	});
});
