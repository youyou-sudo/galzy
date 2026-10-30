import { bffFn } from "@web/lib/bff/fn";
import { queryOptions } from "@tanstack/react-query";
import { type AdSlotPayload, adSlotQueryKey } from "@web/lib/adverts";
import type * as impl from "./../impl/adverts/index";

export const getAdSlot = bffFn<typeof impl.getAdSlot>("adverts.getAdSlot");
export const trackAdvert = bffFn<typeof impl.trackAdvert>("adverts.trackAdvert");

export type * from "./../impl/adverts/index";

/**
 * Root-layout prefetch and the ad slot component share one queryOptions:
 * SSR first paint shows the ad, and the client reuses it for 60s.
 */
export const adSlotQueryOptions = (key: string) =>
	queryOptions({
		queryKey: adSlotQueryKey(key),
		queryFn: async () =>
			(await getAdSlot({ data: { key } })) as unknown as AdSlotPayload | null,
		staleTime: 60_000,
		retry: false,
	});
