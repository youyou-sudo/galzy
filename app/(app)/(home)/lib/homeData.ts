"use server";

import { db } from "@/lib/kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

export const homeData = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize;

  const items = await db
    .selectFrom("galrc_alistb")
    .innerJoin("vn", "galrc_alistb.vid", "vn.id")
    .select((vneb) => [
      "vn.id",
      jsonArrayFrom(
        vneb
          .selectFrom("vn_titles")
          .selectAll()
          .whereRef("vn_titles.id", "=", "vn.id")
      ).as("titles"),
      jsonObjectFrom(
        vneb
          .selectFrom("images")
          .selectAll()
          .whereRef("images.id", "=", "vn.c_image")
      ).as("images"),
    ])
    .select((other) => [
      "galrc_alistb.other",
      jsonObjectFrom(
        other
          .selectFrom("galrc_other")
          .selectAll()
          .whereRef("id", "=", "galrc_alistb.other")
          .select((other) => [
            "galrc_alistb.other",
            jsonArrayFrom(
              other
                .selectFrom("galrc_other_media")
                .selectAll()
                .whereRef("galrc_other_media.other_id", "=", "galrc_other.id")
                .select((om) => [
                  jsonObjectFrom(
                    om
                      .selectFrom("galrc_media")
                      .selectAll()
                      .whereRef(
                        "galrc_media.hash",
                        "=",
                        "galrc_other_media.media_hash"
                      )
                  ).as("media"),
                ])
            ).as("other_media"),
          ])
      ).as("other_datas"),
    ])
    .selectAll()
    .orderBy("vn.id", "desc")
    .orderBy("galrc_alistb.other", "desc")
    .limit(pageSize)
    .offset(offset)
    .execute();


  const totalCountResult = await db
    .selectFrom("galrc_alistb")
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
