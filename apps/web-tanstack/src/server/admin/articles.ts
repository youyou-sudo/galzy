import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/articles";

export const adminGetAllArticles = bffFn<typeof impl.adminGetAllArticles>("admin.articles.adminGetAllArticles");
export const adminUpdateArticle = bffFn<typeof impl.adminUpdateArticle>("admin.articles.adminUpdateArticle");
export const adminDeleteArticle = bffFn<typeof impl.adminDeleteArticle>("admin.articles.adminDeleteArticle");
export const adminChangeArticleStatus = bffFn<typeof impl.adminChangeArticleStatus>("admin.articles.adminChangeArticleStatus");

export type * from "./../impl/admin/articles";
