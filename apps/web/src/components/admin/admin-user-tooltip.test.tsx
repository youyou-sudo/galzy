// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@web/components/ui/tooltip";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminUserTooltip } from "./admin-user-tooltip";

afterEach(() => {
	cleanup();
});

function renderWithProvider(ui: ReactNode) {
	return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("AdminUserTooltip", () => {
	it("shows the user's email and id when hovering the name", async () => {
		renderWithProvider(
			<AdminUserTooltip
				user={{ id: "u_abc123", name: "alice", email: "alice@example.com" }}
			/>,
		);

		fireEvent.mouseEnter(screen.getByText("alice"));

		expect(await screen.findByText("alice@example.com")).toBeTruthy();
		expect(await screen.findByText("ID: u_abc123")).toBeTruthy();
	});

	it("falls back to 无邮箱 when the email is missing", async () => {
		renderWithProvider(
			<AdminUserTooltip user={{ id: "u_abc123", name: "bob" }} />,
		);

		fireEvent.mouseEnter(screen.getByText("bob"));

		expect(await screen.findByText("无邮箱")).toBeTruthy();
	});

	it("renders a plain label when the user is absent", () => {
		renderWithProvider(<AdminUserTooltip user={null} />);

		expect(screen.getByText("未知")).toBeTruthy();
	});
});
