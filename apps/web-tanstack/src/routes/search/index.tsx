import { createFileRoute, redirect } from "@tanstack/react-router";
import { SearchSchema } from "@web/server/search";
import type { z } from "zod";

type SearchParams = z.infer<typeof SearchSchema>;

export const Route = createFileRoute("/search/")({
	validateSearch: SearchSchema,
	loader: async ({ search }) => {
		const { q, startDate, endDate } = search as SearchParams;
		throw redirect({
			to: "/games",
			search: { q, startDate, endDate },
			replace: true,
		});
	},
});
