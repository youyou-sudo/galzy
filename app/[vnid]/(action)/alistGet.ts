"use server";
import prisma from "@/lib/prisma";
import { parse } from "url";
import redis from "@/lib/redis";

export const alistListGet = async (ref: any) => {
  const rekey = `alistListGet:${ref.cloud_id.$oid}/${ref.path}`;
  const cachedData = await redis.get(rekey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const alistdata = await prisma.duptimes.findUnique({
    where: { id: ref.cloud_id.$oid },
  });
  const parsedUrl = parse(alistdata.jsonorl);
  const { protocol, hostname, pathname, port } = parsedUrl;
  const decodedPath = decodeURIComponent(pathname);
  const url = `${protocol}/${hostname}${port ? `:${port}` : ""}/api/fs/list`;

  // 递归获取目录结构的函数
  async function fetchFolderStructure(
    path: string,
    password = "",
    page = 1,
    parentPath = ""
  ): Promise<any> {
    const requestBody = {
      path,
      password,
      page,
      per_page: 0,
      refresh: false,
    };
    // 模拟 API 请求
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (result.code === 200 && result.data && result.data.content) {
      const fileList = [];

      // 遍历当前文件夹中的每个文件或子文件夹
      for (const item of result.data.content) {
        const currentPath = parentPath
          ? `${parentPath}/${item.name}`
          : item.name;

        if (item.is_dir) {
          // 如果是文件夹，递归获取子文件夹的内容
          const subFolderContent = await fetchFolderStructure(
            `${path}/${item.name}`,
            password,
            1,
            currentPath
          );
          fileList.push({
            ...item,
            pathname: currentPath,
            filelist: subFolderContent.length > 0 ? subFolderContent : [], // 确保即使文件夹为空也返回空数组
          });
        } else {
          // 如果是文件，直接加入结果
          fileList.push({
            ...item,
            pathname: currentPath,
          });
        }
      }
      return fileList;
    } else {
      throw new Error("Failed to fetch folder structure");
    }
  }

  try {
    const directoryStructure = await fetchFolderStructure(
      `${decodedPath}/${ref.path}`,
      "",
      1,
      ""
    );
    const datas = {
      status: 200,
      message: "请求成功",
      dlink: alistdata.timeVersion,
      data: directoryStructure,
    };

    await redis.set(rekey, JSON.stringify(datas), "EX", 3600);
    return datas;
  } catch (error) {
    return {
      status: 500,
      message: "请求失败" + error,
      dlink: null,
      data: null,
    };
  }
};
