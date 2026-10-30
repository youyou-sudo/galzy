import { defineRoute } from "@teyik0/furin";
import { redirect } from "@web/lib/nav";
import { SearchSchema } from "@web/server/search";

export const route = defineRoute("/search")
	.config({ mode: "ssr", query: SearchSchema })
	.loader(async ({ query }) => {
		const { q, startDate, endDate } = query;
		throw redirect({
			to: "/games",
			search: { q, startDate, endDate },
			replace: true,
		});
	})
	.page(() => null);
