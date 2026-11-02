import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/topics";

export const adminGetAllTopics = bffFn<typeof impl.adminGetAllTopics>("admin.topics.adminGetAllTopics");
export const adminUpdateTopicStatus = bffFn<typeof impl.adminUpdateTopicStatus>("admin.topics.adminUpdateTopicStatus");
export const adminDeleteTopic = bffFn<typeof impl.adminDeleteTopic>("admin.topics.adminDeleteTopic");

export type * from "./../impl/admin/topics";
