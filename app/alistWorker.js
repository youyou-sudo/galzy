const { parentPort, workerData } = require("worker_threads");
const { ref } = workerData;

const aHeavyTask = async () => {
  const url = new URL(ref.jsonorl);
  const port = url.port;
  const protocol = url.protocol;
  const domain = url.hostname;
  const path = url.pathname + url.search + url.hash;
  const decodedPath = decodeURIComponent(path);
  const results = await fetch(
    `${protocol}/${domain}${port ? `:${port}` : ""}/api/fs/list`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // 告诉服务器这是 JSON 格式的数据
      },
      body: JSON.stringify({
        path: decodedPath,
        page: 1,
        per_page: 0,
        refresh: false,
      }),
    }
  );
  const resultsjson = await results.json();
  const uuzudata = await resultsjson.data.content;
  // 提取字段的函数
  function extractFields(path) {
    const regex = /\[(\w+)-([^\]]+?)\]/g; // 匹配 [字段-值] 格式
    const matches = [...path.matchAll(regex)]; // 获取所有匹配项

    return matches.reduce((acc, match) => {
      const [, field, value] = match; // 从 match 中提取字段和对应值
      if (field && value) {
        if (!acc[field]) {
          acc[field] = [];
        }
        acc[field].push(value); // 将字段和值添加到返回的对象中
      }
      return acc;
    }, {});
  }
  function processFiles(files) {
    return files.map((file) => {
      const vndbFields = extractFields(file.name);
      return {
        name: file.name,
        fields: vndbFields, // 将提取的字段和值存入 fields 中
        size: file.size,
        is_dir: file.is_dir,
      };
    });
  }

  if (resultsjson.code === 200) {
    const processedFiles = processFiles(uuzudata);
    const dodvdobulkOps = processedFiles.flatMap((result) =>
      result.fields.vndb.map((vndb) => ({
        path: result.name,
        vndb: vndb,
        cloud_id: ref.id,
      }))
    );

    const bulkOps = processedFiles.map((result) => ({
      cloudName: ref.name,
      cloud_id: ref.id,
      path: result.name,
      filetype: result.is_dir,
      fields: {
        vndb: result.fields.vndb,
        bgm: result.fields.bgm || undefined,
        steam: result.fields.steam || undefined,
        ymgal: result.fields.ymgal || undefined,
      },
      size: result.size,
      is_dir: result.is_dir,
    }));

    return { alistdata: bulkOps, dodvdo: dodvdobulkOps };
  } else {
    return { error: resultsjson.message };
  }
};

aHeavyTask()
  .then((results) => {
    parentPort.postMessage({ type: "alistdata", data: results.alistdata });
    parentPort.postMessage({ type: "alistdodvdo", data: results.dodvdo });
    process.exit(0);
  })
  .catch((error) => {
    parentPort.postMessage({ error: error.message });
    process.exit(1);
  });
