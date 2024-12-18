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

  const totalDocumentsResult = await prisma.tags.findMany({
    where: {
      gid: id,
    },
    select: {
      gid: true,
      name: true,
      name_zh: true,
      alias: true,
      description: true,
      vndbdatas: {
        select: {
          vndbdata: {
            include: {
              filesiddatas: true,
            },
          },
        },
        where: {
          vndbdata: {
            filesiddatas: {
              some: {},
            },
          },
        },
        skip: (pagess - 1) * pageSize,
        take: pageSize,
      },
      _count: {
        select: {
          vndbdatas: {
            where: {
              vndbdata: {
                filesiddatas: {
                  some: {},
                },
              },
            },
          },
        },
      },
    },
  });

  const totalCount = totalDocumentsResult[0]?._count.vndbdatas || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const datas = {
    page: pagess,
    totalpageCount: totalPages,
    totalCount: totalCount,
    // 处理数据结构
    giddata: {
      ...totalDocumentsResult[0],
      vndbdatas:
        totalDocumentsResult[0]?.vndbdatas.map((item) => item.vndbdata) || [],
    },
  };
  await redis.set(rekey, JSON.stringify(datas), "EX", 43200);
  return datas;
}
