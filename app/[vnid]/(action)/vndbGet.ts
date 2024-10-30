"use server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

// 返回指定 vndbid tag 的数据
export const vndbdatagsdata = async (ref: any) => {
  const rekey = `vndbdatagsdata:${ref.vnid}`;
  const cachedData = await redis.get(rekey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  try {
    const datase = await prisma.vndbdatas.findUnique({
      where: {
        vnid: ref.vnid,
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
                applicable: true,
                defaultspoil: true,
              },
            },
          },
        },
      },
    });

    await redis.set(rekey, JSON.stringify(datase), "EX", 3600);
    return datase;
  } catch (error) {
    return {
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};
