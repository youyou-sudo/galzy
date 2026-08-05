import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import { format, parseISO } from "date-fns";
import { object, string } from "zod/schemas";

export const SearchSchema = object({
	q: string().optional(),
	startDate: string().optional(),
	endDate: string().optional(),
});

export const getSearch = createServerFn()
	.validator(SearchSchema)
	.handler(async ({ data }) => {
		const { data: result, error } = await api.search.games.get({
			query: {
				q: data.q || "",
				hitsPerPage: 100,
				startDate: data.startDate
					? format(parseISO(data.startDate), "yyyy-MM-dd")
					: undefined,
				endDate: data.endDate
					? format(parseISO(data.endDate), "yyyy-MM-dd")
					: undefined,
			},
		});
		elysiaErrorF(error);
		return result;
	});
