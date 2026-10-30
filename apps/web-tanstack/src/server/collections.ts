import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./impl/collections";

export const getCollections = bffFn<typeof impl.getCollections>("collections.getCollections");
export const getCollectionById = bffFn<typeof impl.getCollectionById>("collections.getCollectionById");
export const getCollectionPreview = bffFn<typeof impl.getCollectionPreview>("collections.getCollectionPreview");
export const getCollectionsWithPreview = bffFn<typeof impl.getCollectionsWithPreview>("collections.getCollectionsWithPreview");

export type * from "./impl/collections";
