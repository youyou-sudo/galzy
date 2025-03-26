"use server";
import prisma from "@/lib/prisma";
import prismaDb2 from "@/lib/prisma2";
import { getKv, setKv } from "@/lib/redis";
import type { galRcAlist_search_nodes } from "@/prisma/DB2Client/alistClient";

// sign 计算部分
const hmacSha256Sign = async (path: string, expire: number, token: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const buf = await crypto.subtle.sign(
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    key,
    new TextEncoder().encode(`${path}:${expire}`)
  );
  return (
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_") +
    ":" +
    expire
  );
};

// 新增模块级缓存变量，缓存 token 与 link_expiration
let alistSettingsCache: { token: string; linkExpiration: number } | null = null;

// 修改后的 alistSignGet 函数
export const alistSignGet = async (path: string) => {
  if (!alistSettingsCache) {
    const [tokenData, linkExpirationData] = await Promise.all([
      prismaDb2.galRcAlist_setting_items.findFirst({
        where: { key: "token" },
      }),
      prismaDb2.galRcAlist_setting_items.findFirst({
        where: { key: "link_expiration" },
      }),
    ]);
    alistSettingsCache = {
      token: tokenData!.value!,
      linkExpiration: Number(linkExpirationData?.value),
    };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const expiration = timestamp + 3600 * alistSettingsCache.linkExpiration;
  const sign = await hmacSha256Sign(path, expiration, alistSettingsCache.token);
  return sign;
};

// 获取 alist 配置信息
export const dlinkQuery = async () => {
  const rekey = `dlinkQuery`;
  const cachedData = await getKv(rekey);
  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }
  const data = await prisma.duptimes.findFirst({
    where: { type: "alistData" },
  });
  setTimeout(() => setKv(rekey, JSON.stringify(data), 3600), 0);
  return data;
};

// 获取文件列表
export const fileQuery = async (vid: string) => {
  const vidText = `[vndb-${vid}]`;
  const rekey = `fileQuery:${vid}`;
  const cachedData = await getKv(rekey);
  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }
  const filedata = await prismaDb2.galRcAlist_search_nodes.findMany({
    where: {
      AND: [
        {
          parent: {
            contains: vidText,
          },
        },
        { is_dir: false },
      ],
    },
  });
  const data = buildTree(filedata);
  const output = formatTree(data);
  await processDirectory(output);
  setTimeout(() => setKv(rekey, JSON.stringify(output), 3600), 0);
  return output;
};

// 数据处理部分
interface TreeNode {
  is_dir: boolean;
  size?: number;
  path?: string;
  children?: Record<string, TreeNode>;
}

function buildTree(data: galRcAlist_search_nodes[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  data.forEach((item) => {
    const pathParts = item.parent.split("/").filter(Boolean);
    let current = root;

    pathParts.forEach((part) => {
      if (!current[part]) {
        current[part] = { is_dir: true, children: {} };
      }
      current = current[part].children as Record<string, TreeNode>;
    });

    current[item.name] = {
      is_dir: item.is_dir,
      size: item.size || undefined,
      path: item.parent + "/" + item.name,
    };
  });

  return root;
}

export type FormattedNode = {
  name: string;
  is_dir: boolean;
  path: string;
  size: number;
  children?: FormattedNode[];
  sign?: string;
  compressedFiles?: boolean;
};

function formatTree(tree: Record<string, TreeNode>): FormattedNode[] {
  const format = (
    node: Record<string, TreeNode>,
    parentPath = ""
  ): FormattedNode[] => {
    const result: FormattedNode[] = [];
    for (const [name, value] of Object.entries(node)) {
      const path = parentPath + "/" + name;
      const formattedNode: FormattedNode = {
        name,
        is_dir: value.is_dir,
        path,
        size: value.size ?? 0,
      };
      if (value.children) {
        formattedNode.children = format(value.children, path);
      }
      result.push(formattedNode);
    }
    return result;
  };

  return format(tree);
}

function isSplitArchive(children: any) {
  // 判断是否包含多个 .partX.rar 文件
  const partFiles = children.filter(
    (child: any) => !child.is_dir && child.name.match(/\.part\d+\.rar$/i)
  );
  return partFiles.length > 1;
}


async function processDirectory(data: FormattedNode[]) {
  await Promise.all(
    data.map(async (item: FormattedNode) => {
      if (!item.is_dir) {
        item.sign = await alistSignGet(item.path);
      }
      if (item.is_dir && item.children) {
        // 判断后直接赋值布尔值
        item.compressedFiles = isSplitArchive(item.children);
        await processDirectory(item.children);
      }
    })
  );
}
