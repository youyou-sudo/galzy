import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

// 返回指定vndbid的数据
export const vndbmget = async (ref: any) => {
  const rekey = `vndbGetf:${ref.vnid}`;
  const cachedData = await redis.get(rekey);

  if (cachedData) {
    return JSON.parse(cachedData);
  }
  try {
    const datase = await prisma.vndbdatas.findUnique({
      where: {
        vnid: ref.vnid,
      },
      include: {
        filesiddatas: true,
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
// 返回一共有 VNDB 条目总数
export const vndbdatas = async () => {
  try {
    const datase = await prisma.vndbdatas.count();
    return datase;
  } catch (error) {
    return {
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};

// Home 页面数据
export const vndbmgethome = async (pages?: number, limit = 20) => {
  const rekey = `vndbGetHome:page${pages},limit${limit}`;
  const cachedData = await redis.get(rekey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  try {
    const currentPage = parseInt(pages, 10) || 1;

    const totalCount = await prisma.vndbdatas.count({
      where: {
        filesiddatas: {
          some: {},
        },
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    // 如果请求的页码超出总页数，返回空数据
    if (currentPage > totalPages) {
      return { data: [] };
    }

    // 使用聚合查询当前页的数据
    const datase = await prisma.vndbdatas.findMany({
      where: {
        filesiddatas: {
          some: {},
        },
      },
      include: {
        filesiddatas: true,
      },
      skip: (currentPage - 1) * limit,
      take: limit,
    });

    const redatas = {
      data: datase,
      currentPage,
      totalPages,
      totalCount,
    };
    await redis.set(rekey, JSON.stringify(redatas), "EX", 3600);
    return redatas;
  } catch (error) {
    return {
      data: [],
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};

// 搜索 filedata 数据库对应 vndbid 的数据
export const vndbidExists = async (ref: any) => {
  try {
    if (ref) {
      const result = await prisma.vndbdatas.findUnique({
        where: {
          vnid: ref,
        },
        include: {
          filesiddatas: true,
        },
      });

      return result; // 返回查询结果
    } else {
      return null; // 如果没有传入 vndbid，返回 null
    }
  } catch (error) {
    return {
      mmsess: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "400",
    };
  }
};

// 数据状态
export const datadbup = async () => {
  try {
    const duptimes = await prisma.duptimes.findMany({
      orderBy: {
        id: "asc",
      },
    });

    // 针对每个 `duptime` 单独查询所需的计数
    const counts = await Promise.all(
      duptimes.map(async (duptime) => {
        const [filessCount, vndbCount, tagsCount, tagsVndatasCount] =
          await Promise.all([
            prisma.filesiddatas.count(),
            prisma.vndbdatas.count(),
            prisma.tags.count(),
            prisma.tags_vndatas.count(),
          ]);
        return {
          ...duptime,
          counts: {
            filessCount,
            vndbCount,
            tagsCount,
            tagsVndatasCount,
          },
        };
      })
    );
    return counts;
  } catch (error) {
    return {
      mmsess: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "400",
    };
  }
};

// 编辑数据条目
export const editupdata = async (ref: any) => {
  try {
    if (ref.type === "vndb" && (!ref.id || ref.id.trim() === "")) {
      const tfvndb = await prisma.duptimes.findFirst({
        where: { type: ref.type },
      });
      if (tfvndb) {
        return {
          msess: "vndb 只可存在一个，请查看条目表",
          status: "400",
        };
      } else {
        if (ref.id) {
          await prisma.duptimes.update({
            where: { id: ref.id },
            data: {
              name: ref.name,
              jsonorl: ref.jsonorl,
              timeVersion: ref.timeVersion,
              type: ref.type,
            },
          });
          return {
            msess: "数据更新成功",
            status: "200",
          };
        } else {
          await prisma.duptimes.create({
            data: {
              name: ref.name,
              jsonorl: ref.jsonorl,
              timeVersion: ref.timeVersion,
              type: ref.type,
            },
          });
          return {
            msess: "新数据创建成功",
            status: "200",
          };
        }
      }
    }
    if (ref.id) {
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: {
          name: ref.name,
          jsonorl: ref.jsonorl,
          timeVersion: ref.timeVersion,
          type: ref.type,
        },
      });
      return {
        msess: "数据更新成功",
        status: "200",
      };
    } else {
      try {
        await prisma.duptimes.create({
          data: {
            name: ref.name,
            jsonorl: ref.jsonorl,
            timeVersion: ref.timeVersion,
            type: ref.type,
          },
        });
        return {
          msess: "新数据创建成功",
          status: "200",
        };
      } catch (error) {
        return {
          msess: "创建失败，杂鱼～杂鱼～" + error,
          status: "error",
        };
      }
    }
  } catch (error) {
    return {
      msess: "操作失败，杂鱼～杂鱼～" + error,
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
      filesiddatas: {
        some: {},
      },
    },
  });
  return datasw;
};
