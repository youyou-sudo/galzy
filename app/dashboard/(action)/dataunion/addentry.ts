"use server";

import prisma from "@/lib/prisma";

export const entryAc = async (formdata: any) => {
  const { id, vnid, bangumi_id, ymgal_id, credible } =
    Object.fromEntries(formdata);
  const intCredible = parseInt(credible);

  //   检测输入合法性
  if (!vnid) {
    return { status: "error", message: "vnid不能为空" };
  }
  if (!bangumi_id && !ymgal_id) {
    return { status: "error", message: "bangumi_id和ymgal_id不能同时为空" };
  }

  if (!id) {
    const qid = await prisma.dataunion.findMany({
      where: {
        vnid,
      },
    });
    if (qid.length > 0) {
      return { status: "error", message: "vnid 已存在" };
    } else {
      await prisma.dataunion.create({
        data: {
          vnid,
          bangumi_id,
          ymgal_id,
          credible: intCredible,
        },
      });
      return { status: "success", message: "创建成功" };
    }
  } else {
    const intId = parseInt(id);
    await prisma.dataunion.update({
      where: { id: intId },
      data: {
        vnid,
        bangumi_id,
        ymgal_id,
        credible: intCredible,
      },
    });
    return { status: "success", message: "修改成功" };
  }
};

export const getAllEntry = async (page: number, pageSize: number) => {
  const skip = (page - 1) * pageSize;
  const [data, totalEntries] = await Promise.all([
    prisma.dataunion.findMany({
      skip,
      take: pageSize,
    }),
    prisma.dataunion.count(),
  ]);
  return {
    data,
    totalEntries,
    totalPages: Math.ceil(totalEntries / pageSize),
  };
};

export const deleteEntry = async (id: any) => {
  await prisma.dataunion.delete({
    where: {
      id,
    },
  });
  return { status: "success", message: "删除成功" };
};
