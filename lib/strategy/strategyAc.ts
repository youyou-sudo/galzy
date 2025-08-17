"use server";
import { ContentData } from "@/components/dashboard/dataManagement/strategy/stores/EditStores";
import { db } from "@/lib/kysely";

export const strategyListGet = async (id: string) => {
  const isVNDB = /^v\d+$/.test(id);
  if (isVNDB) {
    const data = await db
      .selectFrom("galrc_article")
      .selectAll()
      .where("type", "=", "strategy")
      .where("vid", "=", id)
      .execute();
    return data;
  } else {
    const data = await db
      .selectFrom("galrc_article")
      .selectAll()
      .where("type", "=", "strategy")
      .where("otherid", "=", Number(id))
      .execute();
    return data;
  }
};

export const strategyListUpdate = async (id: string, data: ContentData) => {
  await db
    .updateTable("galrc_article")
    .where("id", "=", Number(id))
    .set({ ...data })
    .execute();
};

export const strategyListCreate = async (id: string, data: ContentData) => {
  const isVNDB = /^v\d+$/.test(id);
  if (isVNDB) {
    await db
      .insertInto("galrc_article")
      .values({ vid: id, ...data, type: "strategy" })
      .executeTakeFirstOrThrow();
  } else {
    await db
      .insertInto("galrc_article")
      .values({ otherid: Number(id), ...data, type: "strategy" })
      .executeTakeFirstOrThrow();
  }
};

export const strategyListDelete = async (id: string) => {
  try {
    await db
      .deleteFrom("galrc_article")
      .where("id", "=", Number(id))
      .returningAll()
      .execute();
  } catch (e) {
    console.log(e);
  }
};
