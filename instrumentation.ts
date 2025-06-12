import { connection } from "next/server";

// register然后，在文件中导出一个函数
// 新的 Next.js 服务器实例启动时，该函数将被调用一次。
export async function register() {
  connection();
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { workerDataCorn } = await import("./lib/task/workerDataPull");
    const { alistDataCorn } = await import("./lib/task/alistSync");
    workerDataCorn();
    alistDataCorn();
  }
}
