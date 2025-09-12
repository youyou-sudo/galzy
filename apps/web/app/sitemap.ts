import type { MetadataRoute } from 'next'
import { homeData } from './(app)/(home)/(action)/homeData'
export const dynamic = "force-dynamic"
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await homeData(99999999, 0)
  const games = data?.items?.map((game) => ({
    url: `https://galzy.eu.org/${game.id}`,
    changeFrequency: 'monthly' as const,
    priority: 1
  }))!
  return games
}
