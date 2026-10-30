import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/adverts";

export const adminGetAdSlots = bffFn<typeof impl.adminGetAdSlots>("admin.adverts.adminGetAdSlots");
export const adminCreateAdSlot = bffFn<typeof impl.adminCreateAdSlot>("admin.adverts.adminCreateAdSlot");
export const adminUpdateAdSlot = bffFn<typeof impl.adminUpdateAdSlot>("admin.adverts.adminUpdateAdSlot");
export const adminDeleteAdSlot = bffFn<typeof impl.adminDeleteAdSlot>("admin.adverts.adminDeleteAdSlot");
export const adminGetAdverts = bffFn<typeof impl.adminGetAdverts>("admin.adverts.adminGetAdverts");
export const adminCreateAdvert = bffFn<typeof impl.adminCreateAdvert>("admin.adverts.adminCreateAdvert");
export const adminUpdateAdvert = bffFn<typeof impl.adminUpdateAdvert>("admin.adverts.adminUpdateAdvert");
export const adminDeleteAdvert = bffFn<typeof impl.adminDeleteAdvert>("admin.adverts.adminDeleteAdvert");
export const adminReorderAdverts = bffFn<typeof impl.adminReorderAdverts>("admin.adverts.adminReorderAdverts");

export type * from "./../impl/admin/adverts";
