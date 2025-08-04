import React from "react";
import EditComponent from "@/components/dashboard/dataManagement/edit/EditComponent";
import { db } from "@/lib/kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

export default async function page({ params }: { params: { id: string } }) {
  const { id } = await params;
  if (!id) {
    return <div>Invalid ID</div>;
  }
  if (id.startsWith("v")) {
    const vidassociationdata = await db
      .selectFrom("galrc_alistb")
      .selectAll()
      .where("vid", "=", id)
      .select((eb) => [
        "galrc_alistb.other",
        jsonObjectFrom(
          eb
            .selectFrom("galrc_other")
            .selectAll()
            .select((other) => [
              "id",
              jsonArrayFrom(
                other
                  .selectFrom("galrc_other_media")
                  .select((media) => [
                    jsonObjectFrom(
                      media
                        .selectFrom("galrc_media")
                        .selectAll()
                        .whereRef(
                          "galrc_media.id",
                          "=",
                          "galrc_other_media.media_id"
                        )
                    ).as("media"),
                  ])
                  .whereRef("galrc_other_media.other_id", "=", "galrc_other.id")
              ).as("onthermeidia"),
            ])
            .whereRef("galrc_other.id", "=", "galrc_alistb.other")
        ).as("other"),
      ])
      .executeTakeFirst();

    console.log(vidassociationdata);

    if (vidassociationdata?.other === null) {
      const newOtherId = await db
        .insertInto("galrc_other")
        .values({
          status: "draft",
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Update galrc_alistb with the new other_id
      await db
        .updateTable("galrc_alistb")
        .set({ other: newOtherId.id })
        .where("vid", "=", id)
        .execute();
    }
  } else {
  }
  return (
    <div>
      <EditComponent /> 
    </div>
  );
}
