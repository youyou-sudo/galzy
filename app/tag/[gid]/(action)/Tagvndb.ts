"use server";

import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

export async function tagsvndbInfo({
  id,
  pagess,
}: {
  id: string;
  pagess: number;
}) {
  const rekey = `tagsvndbinfo:${id}/${pagess}`;
  const cachedData = await redis.get(rekey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  const pageSize = 50;

  const giddata = await prisma.tags.findUnique({
    where: { gid: id },
  });
  const result = [
    { $match: { gid: id } },
    {
      $lookup: {
        from: "tags_vndatas",
        localField: "gid",
        foreignField: "tag",
        as: "tags_vndatas",
      },
    },
    { $unwind: "$tags_vndatas" },
    {
      $lookup: {
        from: "vndbdatas",
        localField: "tags_vndatas.vid",
        foreignField: "vnid",
        as: "vndbdatas",
      },
    },
    { $unwind: "$vndbdatas" },
    {
      $lookup: {
        from: "files_vndbdatas",
        localField: "vndbdatas.vnid",
        foreignField: "vndb",
        as: "filesdata",
      },
    },
    { $match: { filesdata: { $ne: [] } } },
    {
      $project: {
        _id: 0,
        cloud_id: 0,
        gid: 0,
        cat: 0,
        defaultspoil: 0,
        searchable: 0,
        applicable: 0,
        name: 0,
        alias: 0,
        description: 0,
        "tags_vndatas._id": 0,
        "tags_vndatas.vid": 0,
        "tags_vndatas.unid": 0,
        "tags_vndatas.tag": 0,
        "tags_vndatas.uid": 0,
        "tags_vndatas.cloud_id": 0,
        "vndbdatas._id": 0,
        "vndbdatas.cloud_id": 0,
      },
    },
    {
      $sort: { "tags_vndatas.average_rating": -1 },
    },
    {
      $facet: {
        totalCount: [{ $count: "count" }],
        data: [{ $skip: (pagess - 1) * pageSize }, { $limit: pageSize }],
      },
    },
  ];
  const totalDocumentsResult = await prisma.tags.aggregateRaw({
    pipeline: result,
  });
  const totalCount = totalDocumentsResult[0]?.totalCount[0]?.count;
  const currentPageData = totalDocumentsResult[0]?.data || [];
  const totalpages = Math.ceil(totalCount / pageSize);

  const datas = {
    page: pagess,
    totalpageCount: totalpages,
    totalCount: totalCount,
    giddata: giddata,
    vndbdata: currentPageData,
  };
  await redis.set(rekey, JSON.stringify(datas), "EX", 43200);
  return datas;
}
