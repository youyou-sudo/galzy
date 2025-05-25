import { Queue } from "bullmq";
import { redisConfig } from "@/lib/redis/redis";

export const Queuef = new Queue("myQueue", {
  connection: redisConfig,
});

// async function getAllJobs() {
//   const waiting = await Queuef.getWaiting();
//   const active = await Queuef.getActive();
//   const completed = await Queuef.getCompleted();
//   const failed = await Queuef.getFailed();
//   const delayed = await Queuef.getDelayed();

//   // 合并所有任务
//   const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];
//   return allJobs;
// }

// getAllJobs().then((jobs) => {
//   console.log(`共找到 ${jobs.length} 个任务`);
//   jobs.forEach((job) => {
//     console.log(
//       `任务 name: ${job.name}, 状态: ${
//         job.finishedOn ? "完成" : "未完成"
//       }, ID: ${job.id}`
//     );
//   });
// });
