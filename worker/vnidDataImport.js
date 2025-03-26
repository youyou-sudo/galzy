const { parentPort, workerData } = require("worker_threads");
const { ref } = workerData;

async function aHeavyTask() {
  let allBulkOps = [];
  const chunkSize = 1000;

  try {
    const response = await fetch(ref.jsonurl, { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Failed to fetch update data: ${response.statusText}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          if (!item.id) continue;

          const { id: vnid, ...data } = item;
          allBulkOps.push({ vnid, ...data });

          if (allBulkOps.length >= chunkSize) {
            parentPort.postMessage(allBulkOps);
            allBulkOps = []; // 重新分配数组，减少内存泄漏
          }
        } catch (error) {
          console.error("JSON parsing error:", error.message, line);
        }
      }
    }

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
