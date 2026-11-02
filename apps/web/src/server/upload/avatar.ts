import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/upload/avatar";

export const uploadAvatar = bffFn<typeof impl.uploadAvatar>("upload.avatar.uploadAvatar");

export type * from "./../impl/upload/avatar";
