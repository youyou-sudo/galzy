"use server";
import prisma from "@/lib/prisma";
import { getKv, setKv } from "@/lib/redis";
import type { images, vndbdatas } from "@prisma/client";

export type VndbdImages = vndbdatas & { imagesData: images };

export const vndbmget = async ({ vnid }: { vnid: string }) => {
  const rekey = `vndbGetf:${vnid}`;
  const cachedData = await getKv(rekey);
  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }
  try {
    const datase = await prisma.vndbdatas.findUnique({
      where: {
        vnid: vnid,
      },
      include: {
        imagesData: true,
      },
    });
    await setKv(rekey, JSON.stringify(datase), 3600);
    return datase;
  } catch (error) {
    return {
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};

export const vndbCount = async () => {
  try {
    const rekey = `vndbCount:alist_vndb`;
    const cachedData = await getKv(rekey);

    if (cachedData !== null) {
      return JSON.parse(cachedData);
    }
    const totalCount = await prisma.vndbdatas.count({
      where: { resourceCollection: true },
    });
    const data = {
      totalCount: totalCount,
    };
    await setKv(rekey, JSON.stringify(data), 86400);
    return { data };
  } catch {
    return {
      totalCount: 0,
    };
  }
};

export type VndbmgethomeType = {
  data: VndbdImages[]; // 这里可以改成具体的数据类型
  currentPage: number;
  totalPages: number;
  msessL?: string;
  msess?: string;
  status: string;
  totalCount: number;
};
// Home 页面数据
export const vndbmgethome = async (
  pages?: number,
  limit = 20
): Promise<VndbmgethomeType> => {
  try {
    const totalCountdata = await vndbCount();
    const totalCount = totalCountdata.totalCount;
    const currentPage = pages || 1;
    const totalPages =
      totalCount > 0 ? (((totalCount - 1) / limit) | 0) + 1 : 1;
    // 如果请求的页码超出总页数，返回空数据
    if (currentPage > totalPages) {
      return {
        data: [],
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        msess: "数据库姐姐被掏空了 o(*////▽////*)q: 页面超出范围",
        status: "error",
      };
    }

    const vndbList = await prisma.vndbdatas.findMany({
      where: {
        resourceCollection: true,
      },
      include: {
        imagesData: true,
      },
      skip: (currentPage - 1) * limit,
      take: limit,
      orderBy: {
        id: "desc",
      },
    });

    const redatas = {
      data: vndbList,
      currentPage,
      totalPages,
      msessL: "请求成功",
      status: "200",
    };
    return { ...redatas, totalCount };
  } catch (error) {
    return {
      data: [],
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      msess: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};

export const deleteEntryById = async (id: string) => {
  try {
    const result = await prisma.duptimes.delete({
      where: { id: id },
    });

    if (result) {
      return {
        msess: "条目删除成功",
        status: "200",
      };
    } else {
      return {
        msess: "未找到指定的条目",
        status: "404",
      };
    }
  } catch (error) {
    return {
      msess: "删除失败，杂鱼～杂鱼～" + error,
      status: "error",
    };
  }
};

// 获取 sitemap 数据
export const getSitemapData = async () => {
  const datasw = await prisma.vndbdatas.findMany({
    where: {
      resourceCollection: true,
    },
  });
  return datasw;
};
