"use server";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import { db } from "@/lib/kysely";

export const getVnDetails = async (vid: string) => {
  return db
    .selectFrom("vn")
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
    .where("vn.id", "=", vid)
    .executeTakeFirst();
};
