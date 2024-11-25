"use server";

import { vndbmgethome } from "../vndbdata";

export const getHomeList = async (pagesNumber: number) => {
  const [prevPage, currentPage, nextPage] = await Promise.all([
    pagesNumber > 1 ? vndbmgethome(pagesNumber - 1) : null,
    vndbmgethome(pagesNumber),
    vndbmgethome(pagesNumber + 1),
  ]);

  const allPageData = {
    totalCount: currentPage?.totalCount || 0,
    totalPages: currentPage?.totalPages || 0,
    datas: [
      {
        pagesss: pagesNumber - 1,
        data: prevPage?.data || [],
      },
      {
        pagesss: pagesNumber,
        data: currentPage?.data || [],
      },
      {
        pagesss: pagesNumber + 1,
        data: nextPage?.data || [],
      },
    ],
  };

  return allPageData;
};
