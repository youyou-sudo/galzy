import { getSitemapData } from "@/lib/vndbdata";
import type { vndbdatas } from "@prisma/client";
import type { MetadataRoute } from "next";
import { env } from "next-runtime-env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env("NEXTAUTH_URL");
  const datasw = await getSitemapData();
  const sitemaps = datasw.map((item: vndbdatas) => {
    const lastupdate = item.releases.map(
      (release: { released: any }) => release.released
    );
    let latestDate;
    if (lastupdate && lastupdate.length > 0) {
      latestDate = new Date(
        Math.max(
          ...lastupdate.map((date: string | number | Date) =>
            new Date(date).getTime()
          )
        )
      ).toISOString();
    } else {
      latestDate = new Date().toISOString();
    }

    return {
      url: `${baseUrl}/${item.vnid}`,
      lastModified: new Date(latestDate),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });
  return [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...sitemaps,
  ];
}
