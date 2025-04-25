"use server";
import { deleteEntryById } from "@/lib/vndbdata";
import { distinguishAndUpdate } from "@/lib/task/workerEntrance";
import prisma from "../prisma";
import type { duptimes } from "@/prisma/DBClient";

// 编辑数据条目
export const updatas = async (ref: duptimes) => {
  try {
    if (ref.type === "vndb" && (!ref.id || ref.id.trim() === "")) {
      const tfvndb = await prisma.duptimes.findFirst({
        where: { type: ref.type },
      });
      if (tfvndb) {
        return {
          msess: "vndb 只可存在一个，请查看条目表",
          status: "400",
        };
      } else {
        if (ref.id) {
          await prisma.duptimes.update({
            where: { id: ref.id },
            data: {
              name: ref.name,
              jsonurl: ref.jsonurl,
              timeVersion: ref.timeVersion,
              type: ref.type,
            },
          });
          return {
            msess: "数据更新成功",
            status: "200",
          };
        } else {
          await prisma.duptimes.create({
            data: {
              name: ref.name,
              jsonurl: ref.jsonurl,
              timeVersion: ref.timeVersion,
              type: ref.type,
            },
          });
          return {
            msess: "新数据创建成功",
            status: "200",
          };
        }
      }
    }
    if (ref.id) {
      await prisma.duptimes.update({
        where: { id: ref.id },
        data: {
          name: ref.name,
          jsonurl: ref.jsonurl,
          timeVersion: ref.timeVersion,
          type: ref.type,
        },
      });
      return {
        msess: "数据更新成功",
        status: "200",
      };
    } else {
      try {
        await prisma.duptimes.create({
          data: {
            name: ref.name,
            jsonurl: ref.jsonurl,
            timeVersion: ref.timeVersion,
            type: ref.type,
          },
        });
        return {
          msess: "新数据创建成功",
          status: "200",
        };
      } catch (error) {
        return {
          msess: "创建失败，杂鱼～杂鱼～" + error,
          status: "error",
        };
      }
    }
  } catch (error) {
    return {
      msess: "操作失败，杂鱼～杂鱼～" + error,
      status: "error",
    };
  }
};

// 更新服务器的数据
export const vndbmgetac = async (ref: any) => {
  const { id, name, jsonurl, timeVersion, type } = ref;
  const log = await distinguishAndUpdate({
    id,
    name,
    jsonurl,
    timeVersion,
    type,
  });
  return log;
};

export const deleteProjectEntry = async (id:string) => {
  const log = await deleteEntryById(id);
  return log;
};
