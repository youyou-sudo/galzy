import prisma from "@/lib/prisma";

const BATCH_SIZE = 1000; // 每批处理的文档数量
const CONCURRENT_BATCHES = 5; // 并发处理的批次数量

const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === retries - 1) throw error; // 如果是最后一次尝试，抛出错误
    }
  }
};

export async function meilisearch() {
  try {
    const totalDocumentsCount = await prisma.filesiddatas.count(); // 计算总文档数
    const promises = [];

    for (let offset = 0; offset < totalDocumentsCount; offset += BATCH_SIZE) {
      const totalDocumentsPipeline = [
        {
          $lookup: {
            from: "vndbdatas",
            localField: "fields.vndb",
            foreignField: "vnid",
            as: "vndbdatas",
          },
        },
        { $unwind: "$vndbdatas" }, // 展开 vndbdatas 数组
        {
          $replaceRoot: { newRoot: "$vndbdatas" }, // 替换根文档为展开的 vndbdatas 对象
        },
        {
          $project: {
            _id: 0, // 隐藏 _id 字段
          },
        },
        { $skip: offset }, // 跳过已处理的文档
        { $limit: BATCH_SIZE }, // 限制每次处理的文档数量
      ];

      const datas = await prisma.filesiddatas.aggregateRaw({
        pipeline: totalDocumentsPipeline,
      });
      if (datas.length > 0) {
        promises.push(
          fetchWithRetry(
            `${process.env.MEILI_SEARCH_HOST}/indexes/testindexnew/documents`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.MEILI_ADMIN_API}`,
              },
              body: JSON.stringify(datas),
            }
          )
        );

        // 控制并发
        if (promises.length >= CONCURRENT_BATCHES) {
          await Promise.all(promises); // 等待所有请求完成
          promises.length = 0; // 清空数组
        }
      }
    }

    // 等待最后剩余的请求
    await Promise.all(promises);
  } catch (error) {
    await prisma.meilisearchdatas.update({
      where: { indexName: "alistVN" },
      data: {
        Status: "就绪",
        Statusdescription: `Error during MeiliSearch operation:${error}`,
      },
    });
  }
}
