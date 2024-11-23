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
    `${protocol}//${domain}${port ? `:${port}` : ""}/api/fs/list`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    const regex = /\[(\w+)-([^\]]+?)\]/g;
    const matches = [...path.matchAll(regex)];

    return matches.reduce((acc, match) => {
      const [, field, value] = match;
      if (field && value) {
        if (!acc[field]) {
          acc[field] = [];
        }
        acc[field].push(value);
      }
      return acc;
    }, {});
  }

  function processFiles(files) {
    return files.map((file) => {
      const vndbFields = extractFields(file.name);
      return {
        name: file.name,
        fields: vndbFields,
        size: file.size,
        is_dir: file.is_dir,
      };
    });
  }

  if (resultsjson.code === 200) {
    const processedFiles = processFiles(uuzudata);

    const bulkOps = processedFiles.flatMap((result) => {
      const vndbEntries = result.fields.vndb;

      if (vndbEntries.length === 1) {
        // 只有一个 vndb，创建一个对象
        return [
          {
            cloudName: ref.name,
            cloud_id: ref.id,
            path: result.name,
            filetype: result.is_dir,
            vid: vndbEntries[0],
            size: String(result.size),
            is_dir: result.is_dir,
          },
        ];
      } else {
        // vndb 数组超过一个，创建多个对象，每个对象使用同一个cloud_id
        return vndbEntries.map((vid) => ({
          cloudName: ref.name,
          cloud_id: ref.id,
          vid: vid,
          filetype: result.is_dir,
          is_dir: result.is_dir,
          path: result.name,
          size: String(result.size),
        }));
      }
    });

    return { alistdata: bulkOps };
  } else {
    return { error: resultsjson.message };
  }
};

aHeavyTask()
  .then((results) => {
    parentPort.postMessage({ type: "alistdata", data: results.alistdata });
    process.exit(0);
  })
  .catch((error) => {
    parentPort.postMessage({ error: error.message });
    process.exit(1);
  });
