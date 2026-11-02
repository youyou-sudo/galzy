import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/comments";

export const adminGetComments = bffFn<typeof impl.adminGetComments>("admin.comments.adminGetComments");
export const adminUpdateComment = bffFn<typeof impl.adminUpdateComment>("admin.comments.adminUpdateComment");
export const adminDeleteComment = bffFn<typeof impl.adminDeleteComment>("admin.comments.adminDeleteComment");
export const adminChangeCommentStatus = bffFn<typeof impl.adminChangeCommentStatus>("admin.comments.adminChangeCommentStatus");
export const adminGetAllComments = bffFn<typeof impl.adminGetAllComments>("admin.comments.adminGetAllComments");
export const adminTogglePin = bffFn<typeof impl.adminTogglePin>("admin.comments.adminTogglePin");

export type * from "./../impl/admin/comments";
