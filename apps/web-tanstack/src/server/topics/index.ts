import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/topics/index";

export const getTopics = bffFn<typeof impl.getTopics>("topics.getTopics");
export const getUserFavorites = bffFn<typeof impl.getUserFavorites>("topics.getUserFavorites");
export const getUserLikes = bffFn<typeof impl.getUserLikes>("topics.getUserLikes");
export const getTopic = bffFn<typeof impl.getTopic>("topics.getTopic");
export const createTopic = bffFn<typeof impl.createTopic>("topics.createTopic");
export const updateTopic = bffFn<typeof impl.updateTopic>("topics.updateTopic");
export const toggleTopicLike = bffFn<typeof impl.toggleTopicLike>("topics.toggleTopicLike");
export const toggleTopicFavorite = bffFn<typeof impl.toggleTopicFavorite>("topics.toggleTopicFavorite");
export const deleteTopic = bffFn<typeof impl.deleteTopic>("topics.deleteTopic");

export type * from "./../impl/topics/index";
