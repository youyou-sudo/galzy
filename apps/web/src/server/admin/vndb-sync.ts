import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/vndb-sync";

export const getSyncProgress = bffFn<typeof impl.getSyncProgress>("admin.vndb-sync.getSyncProgress");
export const triggerFullSync = bffFn<typeof impl.triggerFullSync>("admin.vndb-sync.triggerFullSync");
export const triggerDeltaSync = bffFn<typeof impl.triggerDeltaSync>("admin.vndb-sync.triggerDeltaSync");
export const triggerProducersSync = bffFn<typeof impl.triggerProducersSync>("admin.vndb-sync.triggerProducersSync");
export const getCloudreveSyncStatus = bffFn<typeof impl.getCloudreveSyncStatus>("admin.vndb-sync.getCloudreveSyncStatus");
export const triggerCloudreveSync = bffFn<typeof impl.triggerCloudreveSync>("admin.vndb-sync.triggerCloudreveSync");
export const checkCloudreveFiles = bffFn<typeof impl.checkCloudreveFiles>("admin.vndb-sync.checkCloudreveFiles");

export type * from "./../impl/admin/vndb-sync";
