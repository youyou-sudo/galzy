import { createFileRoute } from "@tanstack/react-router";
import TasksPage from "@web/components/admin/tasks-page";
import { listTasks } from "@web/server/admin/tasks";

export const Route = createFileRoute("/admin/_authL/tasks")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: ["admin", "tasks", "list", { pageIndex: 0, pageSize: 20 }],
			queryFn: () => listTasks({ data: { pageIndex: 0, pageSize: 20 } }),
		});
	},
	component: TasksPage,
});
