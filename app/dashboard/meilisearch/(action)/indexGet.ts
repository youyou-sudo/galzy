"use server";
import prisma from "@/lib/prisma";

// 获取索引列表
export const getIndexList = async () => {
  try {
    const meiliconfig = await prisma.meilisearchdatas.findFirst({});
    const adminKey = meiliconfig?.adminKey;
    const response = await fetch(`${meiliconfig?.host}/stats`, {
      cache: "no-cache",
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (data.indexes.alistVN && data.indexes.AllVN) {
      return {
        status: 200,
        message: "成功",
        data: data,
      };
    } else {
      return {
        status: 400,
        message: "没有对应索引，请创建",
      };
    }
  } catch (error) {
    return {
      status: 401,
      message: "获取失败，请检查 HOST" + error,
    };
  }
};

// 创建索引
export const generateIndex = async () => {
  try {
    const meiliconfig = await prisma.meilisearchdatas.findFirst({});
    const adminKey = meiliconfig?.adminKey;
    const response = fetch(`${meiliconfig?.host}/indexes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: "alistVN",
        primaryKey: "vnid",
      }),
    });
    const AllVN = fetch(`${meiliconfig?.host}/indexes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: "AllVN",
        primaryKey: "vnid",
      }),
    });
    const upsertVNDB = await prisma.meilisearchdatas.upsert({
      where: {
        indexName: "AllVN",
      },
      update: {
        indexName: "AllVN",
      },
      create: {
        indexName: "AllVN",
        type: "index",
      },
    });
    const upsertAlistVN = await prisma.meilisearchdatas.upsert({
      where: {
        indexName: "alistVN",
      },
      update: {
        indexName: "alistVN",
      },
      create: {
        indexName: "alistVN",
        type: "index",
      },
    });
    await Promise.all([response, AllVN, upsertVNDB, upsertAlistVN]);
    return {
      status: 200,
      message: "索引创建成功",
    };
  } catch (error) {
    return {
      status: 401,
      message: "获取失败，请检查 HOST" + error,
    };
  }
};

// 建立索引
export const createIndex = async (Type: string) => {
  if (Type === "alistVN") {
    await prisma.meilisearchdatas.update({
      where: { indexName: "alistVN" },
      data: {
        Status: "执行中",
        Statusdescription: `建立索引任务已提交`,
      },
    });

    insertDocumentsToMeilisearch().catch((error) => {
      console.error("Error during document insertion:", error);
    });

    return {
      status: 200,
      message: "已提交任务……",
    };
  } else {
    return {
      status: 400,
      message: "AllVNDB 还未编写脚本",
    };
  }
};

// 插入 alist 关联 VNDB 数据到 Meilisearch
async function insertDocumentsToMeilisearch() {
  const pageSize = 1000; // 每页数据的大小
  let currentPage = 0; // 当前页码
  let hasMoreDocuments = true; // 判断是否还有更多数据

  const meiliconfig = await prisma.meilisearchdatas.findFirst({});
  const adminKey = meiliconfig?.adminKey;
  const meilisearchUrl = `${meiliconfig?.host}/indexes/alistVN/documents`;

  while (hasMoreDocuments) {
    const totalDocumentsPipeline = [
      {
        $lookup: {
          from: "files_vndbdatas",
          localField: "vnid",
          foreignField: "vndb",
          as: "filesdata",
        },
      },
      {
        $match: { "filesdata.0": { $exists: true } },
      },
      { $skip: currentPage * pageSize }, // 跳过当前页的数据
      { $limit: pageSize }, // 每次限制获取1000条数据
    ];

    // 查询分页数据
    const result = await prisma.filesiddatas.aggregateRaw({
      pipeline: totalDocumentsPipeline,
    });

    if (result.length > 0) {
      // 将数据插入到 Meilisearch
      try {
        const response = await fetch(meilisearchUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`, // 如果需要的话，添加API密钥
          },
          body: JSON.stringify(result),
        });

        if (response.ok) {
          await prisma.meilisearchdatas.update({
            where: { indexName: "alistVN" },
            data: {
              Status: "执行中",
              Statusdescription: `Batch ${currentPage + 1} inserted successfully.`,
            },
          });
        } else {
          await prisma.meilisearchdatas.update({
            where: { indexName: "alistVN" },
            data: {
              Status: "error",
              Statusdescription: `Error inserting batch ${currentPage + 1}`,
            },
          });
        }
      } catch (error) {
        await prisma.meilisearchdatas.update({
          where: { indexName: "alistVN" },
          data: {
            Status: "error",
            Statusdescription: `Error inserting batch ${currentPage + 1}：${error}`,
          },
        });
      }

      // 更新页码，准备查询下一页
      currentPage++;
    } else {
      // 如果没有更多数据，结束分页
      hasMoreDocuments = false;
    }
  }

  await prisma.meilisearchdatas.update({
    where: { indexName: "alistVN" },
    data: {
      Status: "就绪",
      Statusdescription: `所有数据均已输入 Meilisearch。`,
    },
  });
}

export const alistVnIndexStu = async () => {
  try {
    const data = await prisma.meilisearchdatas.findFirst({
      where: { indexName: "alistVN" },
    });
    return {
      status: 200,
      message: "请求成功",
      data: data,
    };
  } catch (error) {
    return {
      status: 500,
      message: "内部服务器错误",
    };
  }
};
