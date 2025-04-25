import prisma from "@/lib/prisma";
import prismaDb2 from "@/lib/prisma2";
import type { Ref } from "@/types/dataClass";

export const alistVnImport = async (ref: Ref) => {
  return new Promise((resolve) => {
    setImmediate(async () => {
      try {
        const data = await prismaDb2.galrcalist_search_nodes.findMany({
          where: {
            name: {
              contains: "[vndb-",
            },
          },
        });

        const versions = [
          ...new Set(
            data
              .map(
                (item) =>
                  item.name
                    .match(/\[vndb-(v\d+)\]/g)
                    ?.map((v) => v.match(/\[vndb-(v\d+)\]/)?.at(1) ?? "") || []
              )
              .flat()
          ),
        ];
        const updateVnids = await prisma.vndbdatas.updateMany({
          where: {
            vnid: {
              in: versions,
            },
          },
          data: {
            resourceCollection: true,
          },
        });
        await prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            state: false,
            Statusdescription: `更新成功，更新了 ${updateVnids.count} 条数据`,
          },
        });
        resolve({
          status: "200",
          message: `更新成功，更新了 ${updateVnids.count} 条数据`,
        });
      } catch (error) {
        resolve({
          status: "400",
          message: `出现错误: ${error instanceof Error ? error.message : error}`,
        });
      }
    });
  });
};
