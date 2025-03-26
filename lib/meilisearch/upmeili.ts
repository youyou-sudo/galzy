"use server";

import prisma from "@/lib/prisma";
import type { meilisearchdatas } from "@prisma/client";

// meili 配置创建或修改
export const meilidataupGet = async ({
  id,
  host,
  masterKey,
  indexName,
}: {
  id: string;
  host: string;
  masterKey: string;
  indexName: string;
}) => {
  // 查询是否已有配置
  const existingConfig = await prisma.meilisearchdatas.findFirst({
    where: { type: "config" },
  });

  // 如果已存在配置，返回提示信息
  if (existingConfig && !id) {
    return { statusCode: 201, message: "数据为空 " };
  }

  try {
    if (id === "") {
      // 如果没有 id，则创建新的配置
      await prisma.meilisearchdatas.create({
        data: {
          host: host,
          masterKey: masterKey,
          indexName: indexName,
          type: "config",
        },
      });
      return { statusCode: 200, message: "配置创建成功～" };
    } else {
      // 如果有 id，则更新现有配置
      await prisma.meilisearchdatas.update({
        where: { id: id },
        data: {
          host: host,
          masterKey: masterKey,
          indexName: indexName,
        },
      });
      return { statusCode: 200, message: "配置更新成功" };
    }
  } catch (error) {
    // 捕获错误并返回详细信息
    return {
      statusCode: 500,
      message: "创建/更新 MeilisearchData 时出错",
      error: error,
    };
  }
};

// 获取配置数据
export const meiliconfigGet = async () => {
  try {
    const data = await prisma.meilisearchdatas.findFirst({
      where: { type: "config" },
    });
    return {
      statusCode: "200",
      message: "成功",
      data: data,
    };
  } catch (error) {
    return {
      statusCode: "400",
      message: "貌似发生错误了呢",
      error: JSON.stringify(error, null, 2),
    };
  }
};

// meili Key 获取保存
export const meilidatasGet = async (ref: meilisearchdatas) => {
  try {
    const key = await fetch(`${ref.host}/keys`, {
      cache: "no-cache",
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ref.masterKey}`,
      },
    });
    const keydata = await key.json();
    if (key.ok) {
      const searchKey = await keydata.results.find(
        (item: { name: string }) => item.name === "Default Search API Key"
      );
      const adminKey = await keydata.results.find(
        (item: { name: string }) => item.name === "Default Admin API Key"
      );
      await prisma.meilisearchdatas.update({
        where: { id: ref.id },
        data: {
          adminKey: adminKey.key,
          searchKey: searchKey.key,
        },
      });
      return {
        status: "200",
        message: "KEY 获取成功",
      };
    } else {
      return {
        status: "400",
        message: "貌似发生错误了呢:" + keydata.code,
      };
    }
  } catch (error) {
    return {
      status: "400",
      message: "HOST 请求失败了" + error,
    };
  }
};
