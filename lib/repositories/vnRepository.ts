"use server";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import { db } from "@/lib/kysely";

export const getVnDetails = async (id: string) => {
  const idIsNumber = /^\d+$/.test(id);

  return db
    .selectFrom("galrc_alistb")
    .where((eb) =>
      idIsNumber
        ? eb.or([eb("vid", "=", id), eb("other", "=", Number(id))])
        : eb("vid", "=", id)
    )
    .selectAll()
    .select((eb) => [
      jsonObjectFrom(
        eb
          .selectFrom("vn")
          .whereRef("vn.id", "=", "galrc_alistb.vid")
          .selectAll()
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
            jsonArrayFrom(
              vneb
                .selectFrom("releases_vn")
                .innerJoin("releases", "releases.id", "releases_vn.id")
                .selectAll()
                .select((releaseseVn) => [
                  jsonArrayFrom(
                    releaseseVn
                      .selectFrom("releases_titles")
                      .selectAll()
                      .whereRef(
                        "releases_titles.id",
                        "=",
                        releaseseVn.ref("releases.id")
                      )
                  ).as("titles"),
                ])
                .whereRef("releases_vn.vid", "=", "vn.id")
            ).as("releases"),
          ])
      ).as("vn_datas"),
      jsonObjectFrom(
        eb
          .selectFrom("galrc_other")
          .whereRef("galrc_other.id", "=", "galrc_alistb.other")
          .selectAll()
          .select((other) => [
            "id",
            jsonArrayFrom(
              other
                .selectFrom("galrc_other_media")
                .whereRef("galrc_other_media.other_id", "=", "galrc_other.id")
                .select((media) => [
                  "galrc_other_media.cover",
                  jsonObjectFrom(
                    media
                      .selectFrom("galrc_media")
                      .selectAll()
                      .whereRef(
                        "galrc_media.hash",
                        "=",
                        "galrc_other_media.media_hash"
                      )
                  ).as("media_datas"),
                ])
            ).as("media"),
          ])
      ).as("other_datas"),
    ])
    .executeTakeFirst();
};
