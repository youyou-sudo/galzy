import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/moderation";

export const adminGetModerationSettings = bffFn<
	typeof impl.adminGetModerationSettings
>("admin.moderation.adminGetModerationSettings");
export const adminUpdateModerationSettings = bffFn<
	typeof impl.adminUpdateModerationSettings
>("admin.moderation.adminUpdateModerationSettings");
export const adminTestModeration = bffFn<typeof impl.adminTestModeration>(
	"admin.moderation.adminTestModeration",
);
export const adminGetModerationQueue = bffFn<
	typeof impl.adminGetModerationQueue
>("admin.moderation.adminGetModerationQueue");
export const adminConfirmModeration = bffFn<typeof impl.adminConfirmModeration>(
	"admin.moderation.adminConfirmModeration",
);
export const adminRestoreModeration = bffFn<typeof impl.adminRestoreModeration>(
	"admin.moderation.adminRestoreModeration",
);
export const adminRetryModeration = bffFn<typeof impl.adminRetryModeration>(
	"admin.moderation.adminRetryModeration",
);

export type * from "./../impl/admin/moderation";
