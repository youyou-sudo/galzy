// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	StatusPill,
	Table,
	TableCard,
	TableEmpty,
	TablePagination,
	TableScroll,
	Th,
	THead,
	Tr,
} from "./admin-table";

afterEach(() => {
	cleanup();
});

describe("admin-table primitives", () => {
	it("renders a semantic status pill without raw palette colors", () => {
		const { container } = render(
			<StatusPill tone="success">已完成</StatusPill>,
		);
		const pill = container.firstElementChild as HTMLElement;
		expect(pill.textContent).toBe("已完成");
		expect(pill.className).toContain("bg-success/10");
		expect(pill.className).toContain("text-success");
		expect(pill.className).not.toContain("green-");
	});

	it("renders the shared empty state inside a full-width table cell", () => {
		render(
			<TableCard>
				<TableScroll>
					<Table>
						<THead>
							<Tr>
								<Th>用户</Th>
							</Tr>
						</THead>
						<tbody>
							<TableEmpty colSpan={1} title="暂无用户数据" />
						</tbody>
					</Table>
				</TableScroll>
			</TableCard>,
		);

		expect(screen.getByText("暂无用户数据")).toBeTruthy();
		const cell = screen.getByText("暂无用户数据").closest("td");
		expect(cell?.getAttribute("colspan")).toBe("1");
		expect(screen.getByRole("columnheader").textContent).toBe("用户");
	});

	it("hides pagination on a single page and reports page changes", () => {
		const { rerender } = render(
			<TablePagination
				page={1}
				totalPages={1}
				totalItems={5}
				onPageChange={() => {}}
			/>,
		);
		expect(screen.queryByRole("navigation")).toBeNull();

		const onPageChange = vi.fn();
		rerender(
			<TablePagination
				page={2}
				totalPages={3}
				totalItems={30}
				onPageChange={onPageChange}
			/>,
		);

		expect(screen.getByText("共 30 条")).toBeTruthy();
		fireEvent.click(screen.getByText("下一页"));
		expect(onPageChange).toHaveBeenCalledWith(3);
	});
});
