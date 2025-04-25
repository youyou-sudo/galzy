"use server";

import prisma from "@/lib/prisma";
import { getKv, setKv } from "@/lib/redis";
import type { images, tags, vndbdatas } from "@/prisma/DBClient";

export type TagsvndbInfoType = {
  page: number;
  totalpageCount: number;
  totalCount: number;
  giddata: tags & {
    vndbdatas: (vndbdatas & { imagesData: images })[];
  };
};
export async function tagsvndbInfo({
  id,
  pagess,
}: {
  id: string;
  pagess: number;
}): Promise<TagsvndbInfoType> {
  const pageSize = 50;
  const rekey = `Tag_vndb:${id}page${pagess}`;
  const cachedData = await getKv(rekey);
  if (cachedData !== null) return JSON.parse(cachedData);
  // 缓存 totalCount
  const dataTotalConunt = async (id: string): Promise<number> => {
    const rekey = `Tag_vndb:Count:${id}`;
    const cachedData = await getKv(rekey);
    if (cachedData !== null) return JSON.parse(cachedData);

    const data = await prisma.tags_vndatas.count({
      where: {
        tag: id,
        vndbdatas: {
          resourceCollection: true,
        },
      },
    });

    await setKv(rekey, JSON.stringify(data), 86400);
    return data;
  };

  // 缓存 tagData
  const tagDataAc = async (id: string): Promise<tags | null> => {
    const rekey = `Tag_vndb:TagData:${id}`;
    const cachedData = await getKv(rekey);
    if (cachedData !== null) return JSON.parse(cachedData);

    const data = await prisma.tags.findFirst({
      where: { gid: id },
    });

    await setKv(rekey, JSON.stringify(data), 86400);
    return data;
  };

  // 缓存 tag_vndbData
  const tagVndbDataAc = async (
    id: string,
    pagess: number
  ): Promise<{ vndbdatas: vndbdatas & { imagesData: images } }[]> => {
    const rekey = `Tag_vndb:Data${id}Page${pagess}`;
    const cachedData = await getKv(rekey);
    if (cachedData !== null) return JSON.parse(cachedData);

    const data = await prisma.tags_vndatas.findMany({
      where: {
        tag: id,
        vndbdatas: {
          resourceCollection: true,
        },
      },
      select: {
        vndbdatas: {
          include: {
            imagesData: true,
          },
        },
      },
      skip: (pagess - 1) * pageSize,
      take: pageSize,
    });

    await setKv(rekey, JSON.stringify(data), 3600); // 缓存 1 小时
    return data;
  };

  // 并行查询并保持类型
  const [tag_vndbData, totalCount, tagData] = await Promise.all([
    tagVndbDataAc(id, pagess),
    dataTotalConunt(id),
    tagDataAc(id),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  if (!tagData) {
    throw new Error("Tag not found");
  }

  const data = {
    page: pagess,
    totalpageCount: totalPages,
    totalCount,
    giddata: {
      ...tagData,
      vndbdatas: tag_vndbData.map((item) => item.vndbdatas),
    },
  };
  await setKv(rekey, JSON.stringify(data), 3600); // 缓存 1 小时
  return data;
}
