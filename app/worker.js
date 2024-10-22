const { parentPort, workerData } = require("worker_threads");

const { ref } = workerData;

async function aHeavyTask() {
  try {
    // Fetch the data
    const response = await fetch(ref.jsonorl, { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Failed to fetch update data: ${response.statusText}`);

    const data = await response.json();

    // Ensure the data property exists and is an array
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error(
        "Invalid data format: 'data' property is missing or not an array"
      );
    }

    const newData = data.data;
    const chunkSize = 1000; // Example chunk size
    const allBulkOpsPromises = [];

    for (let i = 0; i < newData.length; i += chunkSize) {
      const chunk = newData.slice(i, i + chunkSize);
      const bulkOps = chunk.map(({ id, ...rest }) => ({
        ...rest, // 解构剩余的属性
        vnid: id, // 将 id 变为 vnid
        cloud_id: ref.id,
      }));
      allBulkOpsPromises.push(bulkOps); // Add bulk ops directly
    }

    // Execute all bulk operations
    const allBulkOps = await Promise.allSettled(allBulkOpsPromises);

    // Handle results and potential errors
    const successfulOps = allBulkOps.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );
    const errors = allBulkOps.filter((result) => result.status === "rejected");

    // Optionally log errors for debugging
    if (errors.length > 0) {
      console.error(
        `Errors during bulk operations:`,
        errors.map((e) => e.reason)
      );
    }

    return successfulOps; // Return all successful bulk operations
  } catch (error) {
    throw new Error(`Error during heavy task: ${error.message}`);
  }
}

// Call the aHeavyTask function and send the result back to the main thread
aHeavyTask()
  .then((results) => {
    parentPort.postMessage(results); // Send the results back to the main thread
    process.exit(0);
  })
  .catch((error) => {
    parentPort.postMessage({ error: error.message }); // Send error back to the main thread
    process.exit(1);
  });
