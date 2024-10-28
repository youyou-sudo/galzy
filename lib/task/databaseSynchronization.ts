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
  // 获取数据库更新时间
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
  const text = await response.text();
  const lines = text.trim().split("\n"); // 按行分割

  // 假设每一行都是独立的 JSON 对象
  const timeVersions = lines
    .map((line) => {
      try {
        const json = JSON.parse(line); // 解析每一行
        return json.timeVersion; // 返回 timeVersion 值
      } catch {
        return null; // 解析失败时返回 null
      }
    })
    .filter((timeVersion) => timeVersion !== null); // 过滤掉 null 值

  // const uptime = new Date(timeVersions[0]).toLocaleString("sv-SE");

  const uptime = new Date(timeVersions[0]).toISOString();
  return { updatetime, uptime };
};

// Worker processing logic
const processInWorker = (ref: Ref, uptime: string) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./app/worker.js", { workerData: { ref } });

    const processInBatches = async (data: any) => {
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

        // 内存清理
        batchedData.slice(i, i + MAX_CONCURRENT_BATCHES).forEach(() => {
          // 手动释放内存
        });

        // 使用 setImmediate 来避免阻塞事件循环
        await new Promise((resolve) => setImmediate(resolve));
      }
    };

    const messageQueue: any[] = [];
    let isProcessing = false;

    worker.on("message", (result) => {
      messageQueue.push(result); // 将新消息放入队列
      processQueue(); // 尝试处理队列
    });

    async function processQueue() {
      if (isProcessing || messageQueue.length === 0) return;

      isProcessing = true; // 设置为正在处理

      const result = messageQueue.shift(); // 取出队列中的第一条消息

      try {
        await processInBatches(result);
        // 更新数据库中的 updatetime 和 state
      } catch (error) {
        reject(error);
      } finally {
        isProcessing = false; // 处理完毕后重置标志位
        processQueue(); // 继续处理下一个消息
      }
      if (messageQueue.length !== 0) {
        await prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            updatetime: uptime,
            state: true,
            Statusdescription: `剩余任务数量: ${messageQueue.length}`,
          },
        });
      } else {
        await prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            updatetime: uptime,
            state: false,
            Statusdescription: "数据更新成功",
          },
        });
      }
    }

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
