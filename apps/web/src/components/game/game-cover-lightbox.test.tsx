// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameCoverLightbox } from "./game-cover-lightbox";

beforeEach(() => {
	window.history.replaceState(null, "", "/");
});

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

describe("GameCoverLightbox", () => {
	it("opens the viewer when the trigger is clicked", async () => {
		render(
			<GameCoverLightbox alt="测试封面" src="https://example.com/cover.jpg">
				<div data-testid="cover-trigger">封面</div>
			</GameCoverLightbox>,
		);

		fireEvent.click(screen.getByTestId("cover-trigger"));

		const dialog = await screen.findByRole("dialog");
		expect(dialog).toBeTruthy();
		expect(
			await screen.findByRole("button", { name: "关闭大图" }),
		).toBeTruthy();
		await waitFor(() => {
			expect(dialog.getAttribute("aria-modal")).toBe("true");
		});
	});

	it("pushes a same-url history entry so mobile back can dismiss it", () => {
		render(
			<GameCoverLightbox alt="测试封面" src="https://example.com/cover.jpg">
				<div data-testid="cover-trigger">封面</div>
			</GameCoverLightbox>,
		);

		const lengthBefore = window.history.length;
		fireEvent.click(screen.getByTestId("cover-trigger"));

		expect(window.history.length).toBe(lengthBefore + 1);
		expect(window.history.state).toMatchObject({
			__galzyCoverLightbox: true,
		});
	});
});
