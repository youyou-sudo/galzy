"use server";

import { db } from "@/lib/kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

export const getTagData = async (tagsid: string) => {
  return await db
    .selectFrom("tags")
    .innerJoin("galrc_zhtag", "tags.id", "galrc_zhtag.id")
    .where("tags.id", "=", tagsid)
    .select([
      "tags.id",
      "tags.name",
      "tags.description",
      "galrc_zhtag.name as zht_name",
      "galrc_zhtag.description as zht_description",
    ])
    .executeTakeFirst();
};

export const getVnListByTag = async (
  tagsid: string,
  pageSize: number,
  pageIndex: number
) => {
  const offset = pageIndex * pageSize;

  // 主数据查询（分页）
  const res = await db
    .selectFrom("tags_vn")
    .innerJoin("galrc_alistb", "galrc_alistb.vid", "tags_vn.vid")
    .where("tags_vn.tag", "=", tagsid)
    .groupBy(["tags_vn.tag", "tags_vn.vid"])
    .select((tagsVn) => [
      jsonObjectFrom(
        tagsVn
          .selectFrom("galrc_alistb")
          .innerJoin("vn", "galrc_alistb.vid", "vn.id")
          .select(["vn.id", "vn.olang"])
          .whereRef("galrc_alistb.vid", "=", "tags_vn.vid")
          .select((vneb) => [
            "vn.id",
            jsonArrayFrom(
              vneb
                .selectFrom("vn_titles")
                .select(["id", "title", "lang"])
                .whereRef("vn_titles.id", "=", "vn.id")
            ).as("titles"),
            jsonObjectFrom(
              vneb
                .selectFrom("images")
                .select(["height", "id", "width"])
                .whereRef("images.id", "=", "vn.c_image")
            ).as("images"),
          ])
          .select((other) => [
            "galrc_alistb.other",
            jsonObjectFrom(
              other
                .selectFrom("galrc_other")
                .whereRef("id", "=", "galrc_alistb.other")
                .selectAll()
                .select((other) => [
                  "galrc_alistb.other",
                  jsonArrayFrom(
                    other
                      .selectFrom("galrc_other_media")
                      .selectAll()
                      .whereRef(
                        "galrc_other_media.other_id",
                        "=",
                        "galrc_other.id"
                      )
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
      ).as("datas"),
    ])
    .orderBy("tags_vn.vid", "desc")
    .limit(pageSize)
    .offset(offset)
    .execute();
  const items = res.map((item) => ({
    ...item.datas,
  }));

  // 总数查询
  const totalCountResult = await db
    .selectFrom("tags_vn")
    .innerJoin("galrc_alistb", "galrc_alistb.vid", "tags_vn.vid")
    .groupBy(["tags_vn.tag", "tags_vn.vid"])
    .select(({ fn }) => [fn.countAll().as("count")])
    .where("tags_vn.tag", "=", tagsid)
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
