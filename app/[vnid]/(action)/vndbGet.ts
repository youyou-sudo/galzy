"use server";
import prisma from "@/lib/prisma";
import { getKv, setKv } from "@/lib/redis";

// 返回指定 vndbid tag 的数据
export const vndbdatagsdata = async (vnid: string) => {
  const rekey = `vnidTagData:${vnid}`;
  const cachedData = await getKv(rekey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  try {
    // 只查询必要字段，并保证字段选择最小化
    const data = await prisma.vndbdatas.findUnique({
      where: {
        vnid: vnid,
      },
      select: {
        tags: {
          orderBy: {
            average_rating: "desc",
          },
          select: {
            average_rating: true,
            average_spoiler: true,
            lie: true,
            tags: {
              select: {
                gid: true,
                name: true,
                name_zh: true,
                applicable: true,
                defaultspoil: true,
              },
            },
          },
        },
      },
    });
    setTimeout(() => setKv(rekey, JSON.stringify(data), 3600), 0);
    return data;
  } catch (error) {
    return {
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};
