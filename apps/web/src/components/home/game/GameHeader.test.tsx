import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { r18Store } from "../../../stores/r18Store";
import { GameHeader } from "./GameHeader";

type GameHeaderProps = ComponentProps<typeof GameHeader>;

const game = {
	vn: {
		titles: [{ lang: "ja", title: "テスト", official: true, main: true }],
		olang: "ja",
		alias: "别名",
		image: {
			imageUrl: "https://vndb-t.galzy.moe/cv.t/12/794.jpg",
			url: "https://vndb-t.galzy.moe/cv/12/794.jpg",
			width: 200,
			height: 300,
			cSexualAvg: 0,
		},
	},
};

describe("GameHeader", () => {
	it("renders a cover lightbox trigger on the server", () => {
		const markup = renderToString(
			<GameHeader game={game as unknown as GameHeaderProps["game"]} id="v17" />,
		);
		expect(markup).toContain(`aria-label="查看《テスト》封面大图"`);
		expect(markup).toContain('type="button"');
	});

	it("does not mount the lightbox trigger for an unrevealed sensitive cover", () => {
		const previous = r18Store.state.showR18;
		r18Store.setState(() => ({ showR18: false }));
		try {
			const sensitiveGame = {
				...game,
				vn: {
					...game.vn,
					image: { ...game.vn.image, cSexualAvg: 2 },
				},
			};
			const markup = renderToString(
				<GameHeader
					game={sensitiveGame as unknown as GameHeaderProps["game"]}
					id="v17"
				/>,
			);
			expect(markup).not.toContain("查看《テスト》封面大图");
			expect(markup).toContain("显示");
		} finally {
			r18Store.setState(() => ({ showR18: previous }));
		}
	});
});
