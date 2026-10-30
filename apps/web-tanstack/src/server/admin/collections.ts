import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/collections";

export const adminGetCollections = bffFn<typeof impl.adminGetCollections>("admin.collections.adminGetCollections");
export const adminCreateCollection = bffFn<typeof impl.adminCreateCollection>("admin.collections.adminCreateCollection");
export const adminUpdateCollection = bffFn<typeof impl.adminUpdateCollection>("admin.collections.adminUpdateCollection");
export const adminDeleteCollection = bffFn<typeof impl.adminDeleteCollection>("admin.collections.adminDeleteCollection");
export const adminUpdateCollectionEntries = bffFn<typeof impl.adminUpdateCollectionEntries>("admin.collections.adminUpdateCollectionEntries");
export const adminSearchProducers = bffFn<typeof impl.adminSearchProducers>("admin.collections.adminSearchProducers");
export const adminSearchGames = bffFn<typeof impl.adminSearchGames>("admin.collections.adminSearchGames");

export type * from "./../impl/admin/collections";
