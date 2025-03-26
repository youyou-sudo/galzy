import prisma from "@/lib/prisma";
import { Worker } from "worker_threads";
import path from "path";

import type { Ref } from "@/types/dataClass";
import { delKv, pushQueue, popQueue } from "@/lib/redis";

// vndb worker
const processInWorker = (ref: Ref, uptime: string) => {
  return new Promise<void>((resolve, reject) => {
    const workerPath = path.resolve(process.cwd(), "worker/vnidDataImport.js");
    const worker = new Worker(workerPath, { workerData: { ref } });

    const processInBatches = async (data: any[]) => {
      const batchSize = 100;
      const batchedData = [];

      for (let i = 0; i < data.length; i += batchSize) {
        batchedData.push(data.slice(i, i + batchSize));
      }

      const MAX_CONCURRENT_BATCHES = 2;
      for (let i = 0; i < batchedData.length; i += MAX_CONCURRENT_BATCHES) {
        const batchPromises = batchedData
          .slice(i, i + MAX_CONCURRENT_BATCHES)
          .map((batch) =>
            prisma.$transaction(
              batch.map((item: any) =>
                prisma.vndbdatas.upsert({
                  where: { vnid: item.vnid },
                  update: item,
                  create: item,
                })
              )
            )
          );
        await Promise.all(batchPromises);
        await new Promise((resolve) => setImmediate(resolve));
      }
    };

    let isProcessing = false;

    worker.on("message", async (result) => {
      await pushQueue(`vndbQueue:${ref.id}`, JSON.stringify(result));
      processQueue();
    });

    async function processQueue() {
      if (isProcessing) return;
      isProcessing = true;

      let cachedData;
      while ((cachedData = await popQueue(`vndbQueue:${ref.id}`)) !== null) {
        const result = JSON.parse(cachedData);
        try {
          await processInBatches(result);
        } catch (error) {
          reject(error);
          return;
        }
      }

      // 更新状态
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: {
          updatetime: uptime,
          state: false,
          Statusdescription: "数据更新成功 vndbtack",
        },
      });

      await delKv(`vndbQueue:${ref.id}`);
      resolve();
    }

    worker.on("error", async (err) => {
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: { Statusdescription: `Worker 线程错误: ${err}` },
      });
      reject(err);
    });

    worker.on("exit", async (code) => {
      if (code !== 0) {
        await prisma.duptimes.update({
          where: { id: ref.id },
          data: { Statusdescription: `Worker 线程退出，错误码 ${code}` },
        });
        reject(new Error(`Worker 线程退出，错误码 ${code}`));
      }
    });
  });
};

// 操作函数
export const vndbmget = async (ref: Ref, uptime: string) => {
  try {
    await prisma.duptimes.update({
      where: { id: ref.id },
      data: { state: true, Statusdescription: "数据更新请求提交成功" },
    });

    processInWorker(ref, uptime).catch(async (error) => {
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: { state: true, Statusdescription: `出现错误: ${error}` },
      });
    });

    return { status: "200", message: "数据更新中" };
  } catch (error) {
    return { status: "400", message: `出现错误: ${error}` };
  }
};
