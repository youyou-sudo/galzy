import { createFileRoute } from "@tanstack/react-router";
import { CommentItem } from "@web/components/cmments";
import { ReplyEidtInput } from "@web/components/cmments/reply-edit-input";
import { GameTabSkeleton } from "@web/components/game/game-tab-skeleton";
import { getCmments } from "@web/server/comments";

export const Route = createFileRoute("/$id/_layout/comment")({
	component: RouteComponent,
	loader: async ({ params: { id } }) => {
		return {
			id,
			commentsData: await getCmments({
				data: {
					targetType: "game",
					targetId: id,
				},
			}),
		};
	},
	headers: () => ({
		"Cache-Control": "public, max-age=5, stale-while-revalidate=600",
	}),

	// Client-side caching (via TanStack Router)
	staleTime: 60_000, // Consider data fresh for 60 seconds on client
	gcTime: 5 * 60_000, // Keep in memory for 5 minutes
	pendingComponent: () => <GameTabSkeleton />,
});

function RouteComponent() {
	const { id } = Route.useLoaderData();
	return (
		<div>
			<ReplyEidtInput targetId={id} commentscomp={true} targetType="game" />
			<CommentItem targetType="game" />
		</div>
	);
}
