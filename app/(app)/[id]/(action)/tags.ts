"use server";
import { db } from "@/lib/kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

export const tagshData = async (id: string) => {
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
                .whereRef("tags.id", "=", "tags_vn.tag")
                .innerJoin("galrc_zhtag", "tags.id", "galrc_zhtag.id")
                .select([
                  "tags.id",
                  "tags.name",
                  "tags.description",
                  "galrc_zhtag.name as zht_name",
                  "galrc_zhtag.description as zht_description",
                ])
            ).as("tag_data"),
          ])
      ).as("tag"),
    ])
    .executeTakeFirst();

  return items;
};
