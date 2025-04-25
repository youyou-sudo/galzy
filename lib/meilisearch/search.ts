"use server"
import { pinyin } from "pinyin-pro";
import * as wanakana from "wanakana";
import prisma from "@/lib/prisma";
import { getKv, setKv } from "@/lib/redis";

export async function search(querydata: string, pages: string) {
  const rekey = `search:${querydata}${pages || 1}`;
  const cachedData = await getKv(rekey);
  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }
  function detectLanguage(text: string) {
    if (/[\u4e00-\u9fff]/.test(text)) {
      return "chinese";
    } else if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) {
      return "japanese";
    } else if (/[\uac00-\ud7af]/.test(text)) {
      return "korean";
    } else {
      return "english";
    }
  }

  function convertTextToRomanized(text: string) {
    const language = detectLanguage(text);
    switch (language) {
      case "chinese":
        return pinyin(text, { toneType: "none" });
      case "japanese":
        return wanakana.toRomaji(text);
      case "korean":
        return text;
      case "english":
      default:
        return text;
    }
  }

  // Convert query data to its romanized version
  const romanizedQuery = convertTextToRomanized(querydata);
  const pageNumber = parseInt(pages);

  // 准备搜索查询
  const queries = {
    queries: [
      {
        indexUid: "alistVN",
        q: `${querydata}`,
        limit: 100,
        hitsPerPage: 50,
        showRankingScore: true,
        page: pageNumber,
      },
      {
        indexUid: "alistVN",
        q: `${romanizedQuery}`,
        limit: 100,
        hitsPerPage: 50,
        showRankingScore: true,
        page: pageNumber,
      },
    ],
  };
  try {
    const meiliconfig = await prisma.meilisearchdatas.findFirst({});
    const searchKey = await meiliconfig?.searchKey;
    const meilisearchUrl = await `${meiliconfig?.host}/multi-search`;

    const response = await fetch(meilisearchUrl, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${searchKey}`,
      },
      body: JSON.stringify(queries),
    });
    const data = await response.json();

    const uniqueHits = {}; // 用于存储去重后的结果
    let maxHitsPerPage = 0; // 最大的 hitsPerPage
    let maxPageNumber = 0; // 最大的 page
    let maxTotalPages = 0; // 最大的 totalPages

    data.results.forEach((result) => {
      result.hits.forEach((hit) => {
        const vnid = hit.vnid;

        // 如果 uniqueHits 中没有这个 vnid，就添加它
        if (!uniqueHits[vnid]) {
          uniqueHits[vnid] = hit;
        }
      });
      // 比较保留最大的 hitsPerPage, page 和 totalPages
      if (result.hitsPerPage && result.hitsPerPage > maxHitsPerPage) {
        maxHitsPerPage = result.hitsPerPage;
      }
      if (result.page && result.page > maxPageNumber) {
        maxPageNumber = result.page;
      }
      if (result.totalPages && result.totalPages > maxTotalPages) {
        maxTotalPages = result.totalPages;
      }
    });
    const hitsArray = Object.values(uniqueHits);
    const datas = {
      hits: hitsArray,
      page: maxHitsPerPage,
      PageNumber: maxPageNumber,
      totalPages: maxTotalPages,
    };

    await setKv(rekey, JSON.stringify(datas), 3600);
    return datas;
  } catch (error) {
    console.error("Error while searching:", error); // Log error for debugging
    return {
      error: "Error while searching: " + error,
      status: "error",
    };
  }
}
