import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import { TopicForm } from "@web/components/topics/topic-form";
import { getSession } from "@web/server/auth/auth.functions";
import { getTopic, updateTopic } from "@web/server/topics";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/topics/$topicId/edit")({
	component: RouteComponent,
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/auth/login", search: { return_to: "/topics" } });
		}
	},
	loader: async ({ params }) => {
		const data = await getTopic({ data: { id: Number(params.topicId) } });
		return data;
	},
});

function RouteComponent() {
	const { topicId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: topic } = useQuery({
		queryKey: ["topic", topicId],
		queryFn: async () => await getTopic({ data: { id: Number(topicId) } }),
		initialData: Route.useLoaderData(),
	});

	const handleSubmit = async (values: {
		title: string;
		content: string;
		contentType: "markdown" | "html";
	}) => {
		try {
			await updateTopic({
				data: {
					id: Number(topicId),
					title: values.title,
					content: values.content,
					contentType: values.contentType,
				},
			});
			queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
			queryClient.invalidateQueries({ queryKey: ["topics"] });
			toast.success("更新成功喵～");
			navigate({ to: "/topics/$topicId", params: { topicId } });
		} catch (error: any) {
			toast.error(error?.message || "更新失败，请稍后重试");
		}
	};

	const breadcrumb = (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/topics" search={{ page: 1 }} />}>
						论坛
					</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbLink
						render={
							<Link to="/topics/$topicId" params={{ topicId }} />
						}
					>
						{(topic as any)?.title ?? "帖子"}
					</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbPage>编辑</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);

	if (!topic) {
		return (
			<div className="mx-auto w-full max-w-4xl">
				{breadcrumb}
				<EmptyState
					surface
					icon={PenLine}
					title="帖子不存在"
					description="它可能已被删除，或者链接不对"
					action={
						<Button
							variant="outline"
							render={<Link to="/topics" search={{ page: 1 }} />}
						>
							返回论坛
						</Button>
					}
				/>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-4xl">
			{breadcrumb}
			<TopicForm
				defaultValues={{
					title: (topic as any).title,
					content: (topic as any).content,
					contentType: (topic as any).contentType || "markdown",
				}}
				onSubmit={handleSubmit}
				title="编辑帖子"
				description="修改后会立即更新帖子的展示内容"
				icon={PenLine}
				submitLabel="保存"
				draftKey={`galzy:draft:topic:edit:${topicId}`}
			/>
		</div>
	);
}
