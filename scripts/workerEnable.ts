import { Worker } from "bullmq";
import { workerDataPull } from "@/lib/queue/workers/CloudFlare/workerDataPull";
import { redisConfig } from "@/lib/redis";

const worker = new Worker(
  "myQueue",
  async (job) => {
    console.log("执行任务:", job.data);
    if (job.name === "workerDataPull") {
      await workerDataPull();
    }
  },
  { connection: redisConfig }
);

worker.on("completed", (job) => {
  console.log(`✅ 任务完成: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ 任务失败: ${job?.id}`, err.message);
});