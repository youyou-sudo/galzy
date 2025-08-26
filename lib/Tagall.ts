"use server";
import { db } from "./kysely";

export const tagAllGet = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize;
  const items = await await db
    .selectFrom("tags")
    .innerJoin("galrc_zhtag", "tags.id", "galrc_zhtag.id")
    .select([
      "tags.id",
      "tags.name",
      "tags.description",
      "galrc_zhtag.name as zh_name",
      "galrc_zhtag.description as zh_description",
      "galrc_zhtag.alias",
    ])
    .where("galrc_zhtag.exhibition", "=", true)
    .limit(pageSize)
    .offset(offset)
    .execute();

  const totalCountResult = await db
    .selectFrom("tags")
    .innerJoin("galrc_zhtag", "tags.id", "galrc_zhtag.id")
    .select(({ fn }) => [fn.countAll().as("count")])
    .executeTakeFirst();

  const totalCount = Number(totalCountResult?.count || 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    items,
    currentPage: pageIndex,
    totalPages,
    totalCount,
  };
};
