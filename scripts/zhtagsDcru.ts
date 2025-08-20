import { db } from "@/lib/kysely";
import fs from "fs";

// 读取 JSON 数据
const data: any[] = JSON.parse(fs.readFileSync("translated.json", "utf-8"));

// 配置每批插入数量
const BATCH_SIZE = 500;

async function insertBatch() {
  console.log(`总共 ${data.length} 条数据，分批插入，每批 ${BATCH_SIZE} 条`);

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);

    try {
      await db
        .insertInto("galrc_zhtag")
        .values(batch)
        .onConflict((oc) => oc.column("id").doNothing()) // 防止重复主键报错
        .execute();

      console.log(`已插入 ${i + batch.length} / ${data.length} 条`);
    } catch (err) {
      console.error(`第 ${i / BATCH_SIZE + 1} 批插入失败:`, err);
    }
  }

  console.log("全部数据插入完成");
}

// 运行
insertBatch()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("插入脚本出错:", err);
    process.exit(1);
  });
