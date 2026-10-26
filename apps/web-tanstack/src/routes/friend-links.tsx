import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import FriendLinksPage from "@web/components/friend-links-page";
import { PageHeader } from "@web/components/shared/page-header";
import { Card } from "@web/components/ui/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { seoTemplate } from "@web/config/seoTemplate";
import { getFriendLinks } from "@web/server/friend-links";
import { HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/friend-links")({
	loader: async () => await getFriendLinks(),
	component: RouteComponent,
	pendingComponent: () => <FriendLinksPageSkeleton />,
	head: () => ({
		meta: [
			{ title: `友情链接 | ${seoTemplate.title}` },
			{
				name: "description",
				content: "喵世界再大，有缘的小伙伴也能像在身边一样呢",
			},
		],
	}),
	headers: () => ({
		// 友情链接已改为数据库驱动：后台改动需要尽快在前台生效，
		// 因此不再沿用旧的 1 小时强缓存（改完最多 1 分钟可见）。
		"Cache-Control":
			"public, max-age=60, s-maxage=60, stale-while-revalidate=300",
		"Cache-Tag": "page-friend-links",
	}),
});

function RouteComponent() {
	const initialData = Route.useLoaderData();

	const { data } = useSuspenseQuery({
		queryKey: ["friend-links"],
		queryFn: () => getFriendLinks(),
		initialData,
		staleTime: 5 * 60_000,
	});

	return <FriendLinksPage links={data} />;
}

/** 与真实页同外壳的骨架：页头先出，卡片网格占位。 */
function FriendLinksPageSkeleton() {
	return (
		<section className="py-6">
			<PageHeader
				align="center"
				icon={HeartHandshake}
				title="🐾 喵の朋友们"
				description="喵世界再大，有缘的小伙伴也能像在身边一样呢"
			/>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<Card key={index} className="h-full">
						<div className="flex gap-4 px-4 py-1">
							<Skeleton className="shrink-0 size-10 rounded-xl" />
							<div className="flex flex-col flex-1 gap-2">
								<Skeleton className="w-24 h-4" />
								<Skeleton className="w-full h-3" />
							</div>
						</div>
					</Card>
				))}
			</div>
		</section>
	);
}
