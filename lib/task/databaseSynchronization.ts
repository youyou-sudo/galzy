import prisma from "@/lib/prisma";
import { stringify } from "flatted";
import { Worker } from "worker_threads";
import path from "path";

interface Ref {
  id: string;
  name: string;
  timeVersion: string;
  jsonorl: string;
  type: string;
}

// 数据库与数据源 time 获取
const fetchAndCompareUpdateTime = async (ref: Ref) => {
  try {
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
      throw new Error(`Fetch failed with status: ${response.status}`);
    }

    const text = await response.text();
    const timeVersions = text
      .trim()
      .split("\n")
      .map((line) => {
        try {
          const json = JSON.parse(line);
          return json.timeVersion;
        } catch {
          return null;
        }
      })
      .filter((timeVersion) => timeVersion !== null);

    const uptime = new Date(timeVersions[0]).toISOString();
    return { updatetime, uptime };
  } catch (error) {
    console.error(`Error in fetchAndCompareUpdateTime: ${error}`);
    throw error;
  }
};

// vndb worker
const processInWorker = (ref: Ref, uptime: string) => {
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve(
      process.cwd(),
      ".next/server/worker/worker.js"
    );
    const worker = new Worker(workerPath, { workerData: { ref } });

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

// tags worker
const tagsprocessInWorker = (ref: Ref, uptime: string) => {
  return new Promise(() => {
    const workerPath = path.resolve(
      process.cwd(),
      ".next/server/worker/tagsWorker.js"
    );
    const worker = new Worker(workerPath, { workerData: { ref } });

    const tagsprocessInBatches = async (data: any) => {
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
                prisma.tags.upsert({
                  where: { gid: item.gid },
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
        await tagsprocessInBatches(result);
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
        // 更新数据库中的 updatetime 和 state
      } catch (error) {
        await prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            updatetime: uptime,
            state: false,
            Statusdescription: `出错${error}`,
          },
        });
      } finally {
        isProcessing = false; // 处理完毕后重置标志位
        processQueue(); // 继续处理下一个消息
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

// gid-vid worker
const gidvidprocessInWorker = (ref: Ref, uptime: string) => {
  return new Promise(() => {
    const workerPath = path.resolve(
      process.cwd(),
      ".next/server/worker/gidvidWorker.js"
    );
    const worker = new Worker(workerPath, { workerData: { ref } });

    const tagsprocessInBatches = async (data: any) => {
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
                prisma.tags_vndatas.upsert({
                  where: { unid: item.unid },
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
        await tagsprocessInBatches(result);
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
        // 更新数据库中的 updatetime 和 state
      } catch (error) {
        await prisma.duptimes.update({
          where: { id: ref.id },
          data: {
            updatetime: uptime,
            state: false,
            Statusdescription: `出错${error}`,
          },
        });
      } finally {
        isProcessing = false; // 处理完毕后重置标志位
        processQueue(); // 继续处理下一个消息
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

// alist worker
const alistWorker = async (ref: Ref) => {
  await prisma.duptimes.update({
    where: { id: ref.id },
    data: { state: true, Statusdescription: "数据任务请求已提交" },
  });

  const workerPath = path.resolve(
    process.cwd(),
    ".next/server/worker/alistWorker.js"
  );
  const worker = new Worker(workerPath, { workerData: { ref } });

  worker.on("message", async (message) => {
    switch (message.type) {
      case "alistdata":
        setImmediate(async () => {
          try {
            await prisma.$transaction([
              prisma.filesiddatas.deleteMany({ where: { cloud_id: ref.id } }),
              prisma.filesiddatas.createMany({ data: message.data }),
              prisma.duptimes.update({
                where: { id: ref.id },
                data: {
                  state: false,
                  Statusdescription: "数据更新已完成1",
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
        break;
      case "alistdodvdo":
        setImmediate(async () => {
          try {
            await prisma.$transaction([
              prisma.files_vndbdatas.deleteMany({
                where: { cloud_id: ref.id },
              }),
              prisma.files_vndbdatas.createMany({ data: message.data }),
              prisma.duptimes.update({
                where: { id: ref.id },
                data: {
                  state: false,
                  Statusdescription: "数据更新已完成2",
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
        break;
    }
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

// 操作函数
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

const alistGet = async (ref: Ref) => {
  try {
    await alistWorker(ref);
    return { status: "200", message: "更新任务提交成功" };
  } catch (error) {
    return { status: "400", message: `失败: ${error}` };
  }
};

const tagsGet = async (ref: Ref) => {
  try {
    const { updatetime, uptime } = await fetchAndCompareUpdateTime(ref);

    if (stringify(updatetime) !== stringify(uptime)) {
      // 不阻塞立即返回
      tagsprocessInWorker(ref, uptime).catch((error) =>
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

const gidvidGet = async (ref: Ref) => {
  try {
    const { updatetime, uptime } = await fetchAndCompareUpdateTime(ref);

    if (stringify(updatetime) !== stringify(uptime)) {
      // 不阻塞立即返回
      gidvidprocessInWorker(ref, uptime).catch((error) =>
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

export const distinguishAndUpdate = async (ref: Ref) => {
  if (ref.type === "vndb") {
    return await vndbmget(ref);
  }
  if (ref.type === "alist") {
    return await alistGet(ref);
  }
  if (ref.type === "vndb_tags") {
    return await tagsGet(ref);
  }
  if (ref.type === "tags-gid-vid") {
    return await gidvidGet(ref);
  }
};
