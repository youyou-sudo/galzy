import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/introduction/index";

export const getIntroductionArticle = bffFn<typeof impl.getIntroductionArticle>("introduction.getIntroductionArticle");
export const getintroductionList = bffFn<typeof impl.getintroductionList>("introduction.getintroductionList");
export const createIntroduction = bffFn<typeof impl.createIntroduction>("introduction.createIntroduction");
export const updateIntroduction = bffFn<typeof impl.updateIntroduction>("introduction.updateIntroduction");
export const deleteIntroduction = bffFn<typeof impl.deleteIntroduction>("introduction.deleteIntroduction");

export type * from "./../impl/introduction/index";
