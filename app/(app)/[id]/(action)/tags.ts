"use server";
import { db } from "@/lib/kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

export const meiliSearchData = async (id: string) => {
  const idIsNumber = /^\d+$/.test(id);
  const items = await db
    .selectFrom("galrc_alistb")
    .innerJoin("vn", "galrc_alistb.vid", "vn.id")
    .where((eb) =>
      idIsNumber
        ? eb.or([eb("vid", "=", id), eb("other", "=", Number(id))])
        : eb("vid", "=", id)
    )
    .select((vneb) => [
      jsonArrayFrom(
        vneb
          .selectFrom("tags_vn")
          .whereRef("tags_vn.vid", "=", "vn.id")
          .groupBy(["tags_vn.tag", "tags_vn.vid"])
          .select((tagsVn) => [
            jsonObjectFrom(
              tagsVn
                .selectFrom("tags")
                .selectAll()
                .whereRef("tags.id", "=", "tags_vn.tag")
            ).as("tag_data"),
          ])
          .select((tagsVn) => [
            jsonObjectFrom(
              tagsVn
                .selectFrom("galrc_zhtag")
                .selectAll()
                .whereRef("galrc_zhtag.id", "=", "tags_vn.tag")
            ).as("tag_zh"),
          ])
      ).as("tag"),
    ])
    .executeTakeFirst();

  return items;
};
