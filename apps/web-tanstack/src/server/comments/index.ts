import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/comments/index";

export const getCmments = bffFn<typeof impl.getCmments>("comments.getCmments");
export const createCmments = bffFn<typeof impl.createCmments>("comments.createCmments");

export type * from "./../impl/comments/index";
