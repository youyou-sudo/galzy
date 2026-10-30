import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/meilisearch";

export const getMeiliSearchProgress = bffFn<typeof impl.getMeiliSearchProgress>("admin.meilisearch.getMeiliSearchProgress");
export const getMeiliStats = bffFn<typeof impl.getMeiliStats>("admin.meilisearch.getMeiliStats");
export const getEmbedders = bffFn<typeof impl.getEmbedders>("admin.meilisearch.getEmbedders");
export const updateEmbedders = bffFn<typeof impl.updateEmbedders>("admin.meilisearch.updateEmbedders");
export const getPropertyList = bffFn<typeof impl.getPropertyList>("admin.meilisearch.getPropertyList");
export const getSearchableAttributes = bffFn<typeof impl.getSearchableAttributes>("admin.meilisearch.getSearchableAttributes");
export const updateSearchableAttributes = bffFn<typeof impl.updateSearchableAttributes>("admin.meilisearch.updateSearchableAttributes");
export const triggerGameIndexRebuild = bffFn<typeof impl.triggerGameIndexRebuild>("admin.meilisearch.triggerGameIndexRebuild");
export const triggerTagIndexRebuild = bffFn<typeof impl.triggerTagIndexRebuild>("admin.meilisearch.triggerTagIndexRebuild");
export const triggerProducerIndexRebuild = bffFn<typeof impl.triggerProducerIndexRebuild>("admin.meilisearch.triggerProducerIndexRebuild");

export type * from "./../impl/admin/meilisearch";
