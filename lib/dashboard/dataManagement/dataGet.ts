"use server";
import { db } from "@/lib/kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

/**
 * 根据传入的 vid 和 otherId 条件，查询 galrc_alistb 表中对应的数据。
 *
 * 三种支持的查询情况（互斥）：
 *
 * 1. 仅传 otherId：
 *    - 查询条件：other IS NOT NULL AND vid IS NULL
 *    - 适用于只希望筛选出存在 other，但没有 vid 的记录。
 *    - NO VBDB
 *
 * 2. 同时传 vid 和 otherId：
 *    - 查询条件：vid IS NOT NULL AND other IS NOT NULL
 *    - 适用于筛选出同时存在 vid 和 other 的记录。
 *    - 已补充数据
 *
 * 3. 仅传 vid：
 *    - 查询条件：vid IS NOT NULL AND other IS NULL
 *    - 适用于只希望筛选出存在 vid，但没有 other 的记录。
 *    - 未补充数据
 *
 * 4. 什么都没传：
 *    - 返回所有数据
 *
 * @param {Object} params 查询条件对象
 * @param {number | null | undefined} params.vid 可选，视频 ID
 * @param {number | null | undefined} params.otherId 可选，其他关联 ID
 * @param {number | null | undefined} params.limit 可选，每页列出多少数据（默认20）
 * @param {number | null | undefined} params.offset 可选，页码（默认第一页）
 * @returns {Promise<any[]>} 查询结果数组
 */

export const dataFilteringGet = async ({
  vid,
  otherId,
  limit = 20,
  offset = 0,
}: {
  vid?: number | null;
  otherId?: number | null;
  limit?: number;
  offset?: number;
} = {}) => {
  const baseQuery = db.selectFrom("galrc_alistb");

  // 构造 where 条件
  let whereQuery = baseQuery;
  if (otherId != null && (vid == null || vid === undefined)) {
    whereQuery = whereQuery
      .where("galrc_alistb.other", "is not", null)
      .where("galrc_alistb.vid", "is", null);
  } else if (vid != null && otherId != null) {
    whereQuery = whereQuery
      .where("galrc_alistb.vid", "is not", null)
      .where("galrc_alistb.other", "is not", null);
  } else if (vid != null && (otherId == null || otherId === undefined)) {
    whereQuery = whereQuery
      .where("galrc_alistb.vid", "is not", null)
      .where("galrc_alistb.other", "is", null);
  }

  // 总数查询
  const totalResult = await whereQuery
    .select(({ fn }) => [fn.countAll<number>().as("count")])
    .executeTakeFirst();

  const total = totalResult?.count ?? 0;

  // 数据查询
  const dataQuery = whereQuery
    .select((qb) => [
      "galrc_alistb.id",
      "galrc_alistb.vid",
      "galrc_alistb.other",
      jsonObjectFrom(
        qb
          .selectFrom("vn")
          .selectAll()
          .whereRef("vn.id", "=", "galrc_alistb.vid")
      ).as("vndatas"),
      jsonObjectFrom(
        qb
          .selectFrom("galrc_other")
          .selectAll()
          .whereRef("galrc_other.id", "=", "galrc_alistb.other")
      ).as("otherdatas"),
    ])
    .limit(limit)
    .offset(offset);

  const data = await dataQuery.execute();

  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * 获取 galrc_alistb 表中 4 类数据的统计信息：
 *  1. `onlyOther`：只存在 other，vid 为 null
 *  2. `bothExist`：vid 和 other 都存在
 *  3. `onlyVid`：只存在 vid，other 为 null
 *  4. `all`：全部数据数量
 */
export const dataFilteringStats = async () => {
  const [onlyOther, bothExist, onlyVid, all] = await Promise.all([
    db
      .selectFrom("galrc_alistb")
      .select(({ fn }) => [fn.countAll<number>().as("count")])
      .where("galrc_alistb.other", "is not", null)
      .where("galrc_alistb.vid", "is", null)
      .executeTakeFirst(),

    db
      .selectFrom("galrc_alistb")
      .select(({ fn }) => [fn.countAll<number>().as("count")])
      .where("galrc_alistb.vid", "is not", null)
      .where("galrc_alistb.other", "is not", null)
      .executeTakeFirst(),

    db
      .selectFrom("galrc_alistb")
      .select(({ fn }) => [fn.countAll<number>().as("count")])
      .where("galrc_alistb.vid", "is not", null)
      .where("galrc_alistb.other", "is", null)
      .executeTakeFirst(),

    db
      .selectFrom("galrc_alistb")
      .select(({ fn }) => [fn.countAll<number>().as("count")])
      .executeTakeFirst(),
  ]);

  return {
    onlyOther: onlyOther?.count ?? 0,
    bothExist: bothExist?.count ?? 0,
    onlyVid: onlyVid?.count ?? 0,
    all: all?.count ?? 0,
  };
};

export const vidassociationGet = async (id: string) => {
  if (!id) {
    throw new Error("Invalid ID");
  }

  if (id.startsWith("v")) {
    const fetchData = async () => {
      return await db
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
                    .whereRef(
                      "galrc_other_media.other_id",
                      "=",
                      "galrc_other.id"
                    )
                ).as("onthermeidia"),
              ])
              .whereRef("galrc_other.id", "=", "galrc_alistb.other")
          ).as("other"),
        ])
        .executeTakeFirst();
    };

    let data = await fetchData();

    if (data?.other === null) {
      const newOtherId = await db
        .insertInto("galrc_other")
        .values({ status: "draft" })
        .returning("id")
        .executeTakeFirstOrThrow();

      await db
        .updateTable("galrc_alistb")
        .set({ other: newOtherId.id })
        .where("vid", "=", id)
        .execute();

      data = await fetchData();
    }

    return data?.other;
  }
};
