"use server";
import prisma from "@/lib/prisma";

export const dataUpQ = async () => {
  const data = await prisma.duptimes.findMany();
  return data;
};

export const coutAcQ = async () => {
  const counts = await Promise.all([
    prisma.tags_vndatas.count(),
    prisma.vndbdatas.count(),
    prisma.vndbdatas.count({
      where: { resourceCollection: true },
    }),
    prisma.tags.count(),
    prisma.images.count(),
  ]);

  return {
    counts: [
      { type: "TagAssVn", count: counts[0] },
      { type: "VndbData", count: counts[1] },
      { type: "alistData", count: counts[2] },
      { type: "tagData", count: counts[3] },
      { type: "VnImages", count: counts[4] },
    ],
  };
};
