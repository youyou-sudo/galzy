import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/friend-links";

export const adminGetFriendLinks = bffFn<typeof impl.adminGetFriendLinks>("admin.friend-links.adminGetFriendLinks");
export const adminCreateFriendLink = bffFn<typeof impl.adminCreateFriendLink>("admin.friend-links.adminCreateFriendLink");
export const adminUpdateFriendLink = bffFn<typeof impl.adminUpdateFriendLink>("admin.friend-links.adminUpdateFriendLink");
export const adminDeleteFriendLink = bffFn<typeof impl.adminDeleteFriendLink>("admin.friend-links.adminDeleteFriendLink");
export const adminReorderFriendLinks = bffFn<typeof impl.adminReorderFriendLinks>("admin.friend-links.adminReorderFriendLinks");

export type * from "./../impl/admin/friend-links";
