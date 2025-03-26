"use server";
import prisma from "@/lib/prisma";
import { stringify } from "flatted";

import type { Ref } from "@/types/dataClass";

import { vndbmget } from "../task/vnidDataImport";
import { tagsGet } from "./vnTagDataImport";
import { gidvidGet } from "./vnTagvidAssociationImport";
import { iamgesGet } from "./vnImagesDataImport";
import { alistVnImport } from "./alistVnImport";

// 数据库与数据源 time 获取
const fetchAndCompareUpdateTime = async (ref: Ref) => {
  try {
    const databaseUpdateTime = await prisma.duptimes.findUnique({
      where: { id: ref.id },
    });
    if (!databaseUpdateTime) throw new Error("Database update time not found");

    const { updatetime } = databaseUpdateTime;
    const response = await fetch(ref.timeVersion, { cache: "no-store" });

    if (!response.ok) {
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: {
          Statusdescription: `Failed to fetch JSON file: ${response.statusText}`,
        },
      });
      throw new Error(`Fetch failed with status: ${response.status}`);
    }

    const text = await response.text();
    const timeVersions = text
      .trim()
      .split("\n")
      .map((line) => {
        try {
          const json = JSON.parse(line);
          return json.timeVersion;
        } catch {
          return null;
        }
      })
      .filter((timeVersion) => timeVersion !== null);

    const uptime = new Date(timeVersions[0]).toISOString();
    return { updatetime, uptime };
  } catch (error) {
    console.error(`Error in fetchAndCompareUpdateTime: ${error}`);
    throw error;
  }
};
export const distinguishAndUpdate = async (ref: Ref) => {
  try {
    if (!ref.id) {
      return { status: "400", message: "请先编辑对应数据配置项" };
    }

    if (ref.type === "alistData") {
      return await alistVnImport(ref);
    }
    
    type UpdateHandler = (ref: Ref, uptime?: any) => Promise<any>;

    const { updatetime, uptime } = await fetchAndCompareUpdateTime(ref);
    if (stringify(updatetime) === stringify(uptime)) {
      return { status: "200", message: "数据已是最新" };
    }

    const updateHandlers: Map<string, UpdateHandler> = new Map([
      ["VndbData", vndbmget],
      ["tagData", tagsGet],
      ["TagAssVn", gidvidGet],
      ["VnImages", iamgesGet],
    ]);

    const handler = updateHandlers.get(ref.type);
    if (handler) return handler(ref, uptime);

    // 如果 type 不匹配，则更新 duptimes 状态
    await prisma.duptimes.update({
      where: { id: ref.id },
      data: { state: true, Statusdescription: "数据更新请求提交成功" },
    });

    return { status: "200", message: "数据更新中" };
  } catch (error) {
    return {
      status: "400",
      message: `出现错误: ${error instanceof Error ? error.message : error}`,
    };
  }
};
