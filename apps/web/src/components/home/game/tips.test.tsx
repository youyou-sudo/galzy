import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DownloadTips, Glgczujm } from "./tips";

/**
 * 下载提示条从「页内广告」里拆出来单独导出：它只属于下载页签。
 * 这里锁住拆分结果，避免以后又把它塞回 Glgczujm（那样所有页签都会冒出来）。
 */
describe("tips", () => {
	it("下载提示只在 DownloadTips 里", () => {
		expect(renderToString(<DownloadTips />)).toContain("IDM");
		expect(renderToString(<Glgczujm />)).not.toContain("IDM");
		expect(renderToString(<Glgczujm />)).not.toContain("Aria2");
	});

	it("页内广告仍然保留机场推荐", () => {
		expect(renderToString(<Glgczujm />)).toContain("如无法下载 / 速度慢");
	});
});
