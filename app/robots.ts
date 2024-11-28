import type { MetadataRoute } from "next";
import { env } from "next-runtime-env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${env("NEXTAUTH_URL")}/sitemap.xml`,
  };
}
