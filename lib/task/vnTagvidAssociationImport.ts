import prisma from "@/lib/prisma";
import { Worker } from "worker_threads";
import path from "path";
import type { Ref } from "@/types/dataClass";
import { delKv, pushQueue, popQueue } from "@/lib/redis";

const BATCH_SIZE = 50; // 减小批量大小以避免过大内存消耗
const PAGE_SIZE = 1000; // 分页查询每次处理的大小

const processInWorker = (ref: Ref, uptime: string) => {
  return new Promise<void>((resolve, reject) => {
    const workerPath = path.resolve(process.cwd(), "worker/gidvidWorker.js");

    // 启动单个 Worker 进行数据处理
    const worker = new Worker(workerPath, { workerData: { ref } });
    let isProcessing = false;

    worker.on("message", async (result) => {
      await pushQueue(`TagVidQueue:${ref.id}`, JSON.stringify(result));
      processQueue().catch(reject);
    });

    worker.on("error", async (err) => {
      console.error("Worker 线程错误:", err);
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: { Statusdescription: `Worker 线程错误: ${err.message}` },
      });
      reject(err);
    });

    worker.on("exit", async (code) => {
      if (code !== 0) {
        console.error(`Worker 线程退出，错误码 ${code}`);
        await prisma.duptimes.update({
          where: { id: ref.id },
          data: { Statusdescription: `Worker 线程退出，错误码 ${code}` },
        });
        reject(new Error(`Worker 线程退出，错误码 ${code}`));
      }
      resolve(); // Worker 完成后完成任务
    });

    async function processQueue() {
      if (isProcessing) return;
      isProcessing = true;

      // eslint-disable-next-line prefer-const
      let tasks: any[] = [];
      let cachedData = await popQueue(`TagVidQueue:${ref.id}`);

      while (cachedData) {
        const dataBatch = JSON.parse(cachedData);
        tasks.push(...dataBatch);

        if (tasks.length >= BATCH_SIZE) {
          await processInBatches(tasks.splice(0, BATCH_SIZE));
        }
        cachedData = await popQueue(`TagVidQueue:${ref.id}`);
      }

      if (tasks.length > 0) {
        await processInBatches(tasks);
      }

      await prisma.duptimes.update({
        where: { id: ref.id },
        data: {
          updatetime: uptime,
          state: false,
          Statusdescription: "数据更新成功 Tagvidtack",
        },
      });

      resolve();
    }

    async function processInBatches(data: any[]) {
      const batchPromises = [];
      for (let i = 0; i < data.length; i += PAGE_SIZE) {
        const batch = data.slice(i, i + PAGE_SIZE);
        batchPromises.push(
          prisma.$transaction(
            batch.map((item) =>
              prisma.tags_vndatas.upsert({
                where: { unid: item.unid },
                update: item,
                create: item,
              })
            )
          )
        );
      }

      await Promise.all(batchPromises);
    }
  });
};

// 操作函数
export const gidvidGet = async (ref: Ref, uptime: string) => {
  try {
    await prisma.duptimes.update({
      where: { id: ref.id },
      data: { state: true, Statusdescription: "数据更新请求提交成功" },
    });

    processInWorker(ref, uptime).catch(async (error) => {
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: { state: true, Statusdescription: `出现错误: ${error.message}` },
      });
    });

    return { status: "200", message: "数据更新中" };
  } catch (error) {
    return { status: "400", message: `出现错误: ${error}` };
  }
};
