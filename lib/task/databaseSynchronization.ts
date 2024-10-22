import prisma from "@/lib/prisma";
import { stringify } from "flatted";
import { Worker } from "worker_threads";

interface Ref {
  id: string;
  name: string;
  timeVersion: string;
  jsonorl: string;
  type: string;
}

// Helper function to handle the fetching and comparison of update time
const fetchAndCompareUpdateTime = async (ref: Ref) => {
  const databaseUpdateTime = await prisma.duptimes.findUnique({
    where: { id: ref.id },
  });
  if (!databaseUpdateTime) throw new Error("Database update time not found");

  const { updatetime } = databaseUpdateTime;
  const response = await fetch(ref.timeVersion, { cache: "no-store" });

  if (!response.ok) {
    await prisma.duptimes.update({
      where: { id: ref.id },
      data: {
        Statusdescription: `Failed to fetch JSON file: ${response.statusText}`,
      },
    });
  }
  const jsonData = await response.json();
  const uptime = new Date(jsonData.timeVersion).toISOString("sv-SE", {
    timeZoneName: "short",
  });

  return { updatetime, uptime };
};

// Worker processing logic
const processInWorker = (ref: Ref, uptime: string) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./app/worker.js", { workerData: { ref } });

    const processInBatches = async (data) => {
      const batchSize = 100;
      const batchedData = [];

      // 数据分批
      for (let i = 0; i < data.length; i += batchSize) {
        batchedData.push(data.slice(i, i + batchSize));
      }

      const MAX_CONCURRENT_BATCHES = 2;

      for (let i = 0; i < batchedData.length; i += MAX_CONCURRENT_BATCHES) {
        const batchPromises = batchedData
          .slice(i, i + MAX_CONCURRENT_BATCHES)
          .map((batch) =>
            prisma.$transaction(
              batch.map((item) =>
                prisma.vndbdatas.upsert({
                  where: { vnid: item.vnid },
                  update: item,
                  create: item,
                })
              )
            )
          );

        // 打印当前批次处理的时间
        const startTime = Date.now();
        await Promise.all(batchPromises);
        const endTime = Date.now();
        prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            Statusdescription: `Batch ${i / MAX_CONCURRENT_BATCHES + 1} processed in ${
              endTime - startTime
            }ms`,
          },
        });

        // 内存清理
        batchedData.slice(i, i + MAX_CONCURRENT_BATCHES).forEach(() => {
          // 手动释放内存
        });

        // 使用 setImmediate 来避免阻塞事件循环
        await new Promise((resolve) => setImmediate(resolve));
      }
    };

    worker.on("message", async (result) => {
      try {
        setImmediate(async () => {
          if (Array.isArray(result) && result.length > 0) {
            await processInBatches(result);
            // 更新数据库中的 updatetime 和 state
            await prisma.duptimes.update({
              where: { id: ref.id },
              data: {
                updatetime: uptime,
                state: false,
                Statusdescription: "数据更新成功",
              },
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });

    worker.on("error", (err) => {
      prisma.duptimes.update({
        where: { id: ref.id },
        data: {
          Statusdescription: `Worker thread encountered an error:${err}`,
        },
      });
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            Statusdescription: `Worker stopped with exit code ${code}`,
          },
        });
      }
    });
  });
};

// Main function to process alist type
const alistWorker = async (ref: Ref) => {
  await prisma.duptimes.update({
    where: { id: ref.id },
    data: { state: true, Statusdescription: "数据任务请求已提交" },
  });

  const worker = new Worker("./app/alistWorker.js", { workerData: { ref } });

  worker.on("message", async (result) => {
    setImmediate(async () => {
      try {
        await prisma.$transaction([
          prisma.filesiddatas.deleteMany({ where: { cloud_id: ref.id } }), // 删除所有文件数据
          prisma.filesiddatas.createMany({ data: result }), // 插入新的文件数据
          prisma.duptimes.update({
            where: { id: ref.id },
            data: {
              state: false,
              Statusdescription: "数据更新已完成",
            },
          }),
        ]);
      } catch (error) {
        prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            Statusdescription: `Transaction failed, rolled back: ${error}`,
          },
        });
      }
    });
  });

  worker.on("error", (err) => {
    prisma.duptimes.update({
      where: { id: ref.id },
      data: {
        Statusdescription: `Worker thread encountered an error: ${err}`,
      },
    });
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      prisma.duptimes.update({
        where: { id: ref.id },
        data: {
          Statusdescription: `Worker stopped with exit code ${code}`,
        },
      });
    }
  });
};

// Main function to process vndb type
const vndbmget = async (ref: Ref) => {
  try {
    const { updatetime, uptime } = await fetchAndCompareUpdateTime(ref);

    if (stringify(updatetime) !== stringify(uptime)) {
      // 不阻塞立即返回
      processInWorker(ref, uptime).catch((error) =>
        prisma.duptimes.update({
          where: { id: ref.id },
          data: { state: true, Statusdescription: `出现错误${error}` },
        })
      );
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: { state: true, Statusdescription: "数据更新请求提交成功" },
      });
      return { status: "200", message: "数据更新中" };
    } else {
      return { status: "200", message: "数据已是最新" };
    }
  } catch (error) {
    return { status: "400", message: `出现错误: ${error}` };
  }
};

// Function to distinguish between types and update accordingly
const alistGet = async (ref: Ref) => {
  try {
    await alistWorker(ref);
    return { status: "200", message: "更新任务提交成功" };
  } catch (error) {
    return { status: "400", message: `失败: ${error}` };
  }
};

export const distinguishAndUpdate = async (ref: Ref) => {
  if (ref.type === "vndb") {
    return await vndbmget(ref);
  }
  if (ref.type === "alist") {
    return await alistGet(ref);
  }
};
