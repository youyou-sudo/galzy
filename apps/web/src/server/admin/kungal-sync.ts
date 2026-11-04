import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/kungal-sync";

export const getKungalSyncProgress = bffFn<typeof impl.getKungalSyncProgress>(
	"admin.kungal-sync.getKungalSyncProgress",
);
export const triggerKungalFullSync = bffFn<typeof impl.triggerKungalFullSync>(
	"admin.kungal-sync.triggerKungalFullSync",
);
export const triggerKungalDeltaSync = bffFn<typeof impl.triggerKungalDeltaSync>(
	"admin.kungal-sync.triggerKungalDeltaSync",
);
export const triggerKungalCharactersSync = bffFn<
	typeof impl.triggerKungalCharactersSync
>("admin.kungal-sync.triggerKungalCharactersSync");
export const triggerKungalWalkthroughsSync = bffFn<
	typeof impl.triggerKungalWalkthroughsSync
>("admin.kungal-sync.triggerKungalWalkthroughsSync");

export type * from "./../impl/admin/kungal-sync";
