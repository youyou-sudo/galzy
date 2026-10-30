import { defineRoute } from "@teyik0/furin";
import { useSuspenseQuery } from "@tanstack/react-query";
import FriendLinksPage from "@web/components/friend-links-page";
import { seoTemplate } from "@web/config/seoTemplate";
import {
	FRIEND_LINKS_PAGE,
	FRIEND_LINKS_QUERY_KEY,
} from "@web/lib/friend-links";
import { getFriendLinks } from "@web/server/friend-links";

export const route = defineRoute("/friend-links")
	.config({ mode: "ssr" })
	.loader(async () => {
		const links = await getFriendLinks({ data: {} });
		return { links };
	})
	.head(() => ({
		meta: [
			{ title: `友情链接 | ${seoTemplate.title}` },
			{ name: "description", content: FRIEND_LINKS_PAGE.description },
		],
	}))
	.page(({ links }) => <FriendLinksRoute initialData={links} />);

function FriendLinksRoute({ initialData }: { initialData: unknown }) {
	const { data } = useSuspenseQuery({
		queryKey: FRIEND_LINKS_QUERY_KEY,
		queryFn: () => getFriendLinks({ data: {} }),
		initialData: initialData as Awaited<ReturnType<typeof getFriendLinks>>,
		// 与 CDN 的 60s 对齐：客户端二次进入最多旧 30s
		staleTime: 30_000,
	});

	return <FriendLinksPage links={data} />;
}
