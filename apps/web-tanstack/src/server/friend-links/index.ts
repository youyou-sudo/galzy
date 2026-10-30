import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/friend-links/index";

export const getFriendLinks = bffFn<typeof impl.getFriendLinks>("friend-links.getFriendLinks");

export type * from "./../impl/friend-links/index";
