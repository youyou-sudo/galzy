import prisma from "@/lib/prisma";

// 返回指定vndbid的数据
export const vndbmget = async (ref: any) => {
  try {
    const datase = await prisma.vndbdatas.findUnique({
      where: {
        vnid: ref.vnid,
      },
    });
    return datase;
  } catch (error) {
    return {
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};

// 返回文件条目总数
export const vndbCount = async () => {
  try {
    const datase = await prisma.filesiddatas.count();
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
export const vndbmgethome = async (pages?: string, limit = 10) => {
  try {
    const currentPage = parseInt(pages, 10) || 1;

    // 聚合查询获取文档总数
    const totalDocumentsPipeline = [
      { $unwind: "$fields.vndb" },
      {
        $lookup: {
          from: "vndbdatas",
          localField: "fields.vndb",
          foreignField: "vnid",
          as: "vndbdatas",
        },
      },
      { $unwind: "$vndbdatas" },
      { $replaceRoot: { newRoot: "$vndbdatas" } },
      {
        $group: {
          _id: "$vnid", // 按照 vndb ID 去重（Files 中 可能存在多个相同 VNDB ID 的不同文件夹）
          doc: { $first: "$$ROOT" }, // 保留第一条记录
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $count: "total" },
    ];

    const totalDocumentsResult = await prisma.filesiddatas.aggregateRaw({
      pipeline: totalDocumentsPipeline,
    });
    const totalDocuments =
      totalDocumentsResult.length > 0 ? totalDocumentsResult[0].total : 0;

    // 计算总页数
    const totalPages = Math.ceil(totalDocuments / limit);

    // 如果请求的页码超出总页数，返回空数据
    if (currentPage > totalPages) {
      return {
        data: [],
        currentPage,
        totalPages,
        totalDocuments,
      };
    }

    // 计算跳过的文档数量
    const skip = (currentPage - 1) * limit;

    // 使用聚合查询当前页的数据
    const dataPipeline = [
      { $unwind: "$fields.vndb" },
      {
        $lookup: {
          from: "vndbdatas",
          localField: "fields.vndb",
          foreignField: "vnid",
          as: "vndbdatas",
        },
      },
      { $unwind: "$vndbdatas" },
      { $replaceRoot: { newRoot: "$vndbdatas" } },
      {
        $group: {
          _id: "$vnid", // 按照 vndb ID 去重（Files 中 可能存在多个相同 VNDB ID 的不同文件夹）
          doc: { $first: "$$ROOT" }, // 保留第一条记录
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { "releases.released": -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const datase = await prisma.filesiddatas.aggregateRaw({
      pipeline: dataPipeline,
    });
    // 返回数据、当前页、总页数等信息
    return {
      data: datase,
      currentPage,
      totalPages,
      totalDocuments,
    };
  } catch (error) {
    return {
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};

export const datadbtests = async () => {
  try {
    // 使用聚合查询当前页的数据
    const dataPipeline = [
      {
        $lookup: {
          from: "vndbdatas",
          localField: "fields.vndb",
          foreignField: "id",
          as: "vndbdatas",
        },
      },
    ];
    const datase = await prisma.filesiddatas.aggregateRaw({
      pipeline: dataPipeline,
    });
    return datase;
  } catch (error) {
    return {
      error: "数据库姐姐被掏空了 o(*////▽////*)q: " + error,
      status: "error",
    };
  }
};

// 搜索 filedata 数据库对应 vndbid 的数据
export const vndbidExists = async (ref: any) => {
  try {
    if (ref) {
      const result = await prisma.filesiddatas.aggregateRaw({
        pipeline: [
          {
            $match: {
              $or: [
                { "fields.vndb": { $in: ref } },
                { "fields.bgm": { $in: ref } },
                { "fields.steam": { $in: ref } },
              ],
            },
          },
        ],
      });

      return result[0]; // 返回查询结果
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
    const result = await prisma.duptimes.findMany({
      include: {
        _count: {
          select: {
            filess: true, // 统计关联的 filess（filesiddatas）数量
            vndb: true, // 统计关联的 vndbdatas（vndbdatas）数量
          },
        },
      },
    });
    return result;
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
        const log = await prisma.duptimes.create({
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
