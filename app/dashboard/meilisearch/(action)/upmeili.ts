"use server";

import prisma from "@/lib/prisma";

// meili 配置创建或修改
export const meilidataupGet = async (formData) => {
  const { id, host, masterKey, indexName } = Object.fromEntries(formData);

  // 查询是否已有配置
  const existingConfig = await prisma.meilisearchdatas.findFirst({
    where: { type: "config" },
  });

  // 如果已存在配置，返回提示信息
  if (existingConfig && !id) {
    return {
      status: 400,
      message: "❗主人，已经有一个配置了哦～",
    };
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
      return {
        status: 200,
        message: "配置创建成功",
      };
    } else {
      // 如果有 id，则更新现有配置
      await prisma.meilisearchdatas.update({
        where: { id },
        data: {
          host: host,
          masterKey: masterKey,
          indexName: indexName,
        },
      });
      return {
        status: 200,
        message: "配置更新成功",
      };
    }
  } catch (error) {
    // 捕获错误并返回详细信息
    return {
      status: 400,
      message: "Error creating/updating MeilisearchData: " + error,
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
      status: "200",
      message: "成功",
      data: data,
    };
  } catch (error) {
    return {
      status: "400",
      message: "貌似发生错误了呢" + error,
      data: null,
    };
  }
};

// meili Key 获取保存
export const meilidatasGet = async (ref) => {
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
        (item) => item.name === "Default Search API Key"
      );
      const adminKey = await keydata.results.find(
        (item) => item.name === "Default Admin API Key"
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
