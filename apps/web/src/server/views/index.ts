import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/views/index";

export const recordGameView = bffFn<typeof impl.recordGameView>("views.recordGameView");
export const recordTagView = bffFn<typeof impl.recordTagView>("views.recordTagView");
export const recordTopicView = bffFn<typeof impl.recordTopicView>("views.recordTopicView");

export type * from "./../impl/views/index";
