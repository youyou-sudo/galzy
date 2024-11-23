const { parentPort, workerData } = require("worker_threads");
const { ref } = workerData;

async function aHeavyTask() {
  const allBulkOps = [];
  const chunkSize = 1000;

  try {
    const response = await fetch(ref.jsonorl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch update data: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value || new Uint8Array(), { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // 保存未处理的最后一行

      for (const line of lines) {
        if (line) {
          try {
            const item = JSON.parse(line);
            let gid = item.id;
            delete item.id;
            allBulkOps.push({
              ...item,
              cloud_id: ref.id,
              gid: gid,
            });

            // 一旦积累达到 chunkSize，发送并清空数组
            if (allBulkOps.length >= chunkSize) {
              parentPort.postMessage(allBulkOps);
              allBulkOps.length = 0; // 清空数组
            }
          } catch (error) {
            console.error("JSON parsing error:", error, line);
          }
        }
      }
    }

    // 发送剩余的操作
    if (allBulkOps.length > 0) {
      parentPort.postMessage(allBulkOps);
    }
  } catch (error) {
    parentPort.postMessage({
      error: `Error during heavy task: ${error.message}`,
    });
  }
}

aHeavyTask()
  .then(() => console.log("Task completed"))
  .catch((error) => console.error("Task failed:", error.message));
