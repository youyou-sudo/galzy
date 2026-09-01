import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { TopicForm } from "@web/components/topics/topic-form";
import { getSession } from "@web/server/auth/auth.functions";
import { getTopic, updateTopic } from "@web/server/topics";
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

	if (!topic) {
		return (
			<div className="text-center py-12 text-muted-foreground">帖子不存在</div>
		);
	}

	return (
		<div>
			<TopicForm
				defaultValues={{
					title: (topic as any).title,
					content: (topic as any).content,
					contentType: (topic as any).contentType || "markdown",
				}}
				onSubmit={handleSubmit}
				title="编辑帖子"
				submitLabel="保存"
			/>
		</div>
	);
}
