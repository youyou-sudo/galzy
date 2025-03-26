const { parentPort, workerData } = require("worker_threads");
const { ref } = workerData;

async function aHeavyTask() {
  const chunkSize = 500; // 降低单次处理量
  let allBulkOps = []; // 使用 let 便于重置时释放内存
  const decoder = new TextDecoder("utf-8");

  try {
    const response = await fetch(ref.jsonurl, { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Failed to fetch: ${response.statusText}`);

    const reader = response.body.getReader();
    let buffer = new Uint8Array(0); // 二进制缓冲区

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 合并缓冲区并查找换行符
      buffer = mergeBuffers(buffer, value);
      let lineEnd;

      while ((lineEnd = buffer.indexOf(10)) >= 0) {
        // 10 = '\n'
        // 提取单行数据并解析
        const line = decoder.decode(buffer.subarray(0, lineEnd));
        buffer = buffer.subarray(lineEnd + 1);

        try {
          allBulkOps.push({
            ...JSON.parse(line),
          });

          // 分块发送并释放内存
          if (allBulkOps.length >= chunkSize) {
            const chunk = allBulkOps;
            allBulkOps = [];
            parentPort.postMessage(chunk);
            await yieldEventLoop(); // 事件循环让步
          }
        } catch (error) {
          console.error("Parse error:", error.message);
        }
      }
    }

    // 发送剩余数据
    if (allBulkOps.length > 0) parentPort.postMessage(allBulkOps);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
}

// 合并缓冲区避免内存碎片
function mergeBuffers(a, b) {
  const merged = new Uint8Array(a.length + (b?.length || 0));
  merged.set(a);
  if (b) merged.set(b, a.length);
  return merged;
}

// 每批次处理让出事件循环
function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

aHeavyTask()
  .then(() => parentPort.postMessage("done"))
  .catch((e) => parentPort.postMessage({ error: e.message }));
