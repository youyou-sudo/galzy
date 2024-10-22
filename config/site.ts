export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "GnGame",
  description:
    "又又又一个视觉小说资源站喵～；收录各种恋爱养成游戏、美少女游戏(ACGgame, Galgame)、二次元视觉小说等ACG领域资源的类别。提供游戏简介，讨论，资源下载。",
  keywords: [
    "Galgame",
    "美少女游戏",
    "二次元视觉小说",
    "ギャルゲーム",
    "ACGgame",
    "Gal",
    " Visual Novel",
    "视觉小说",
    "Game",
  ],
  navItems: [
    {
      label: "主页",
      href: "/",
    },
  ],
  dashboard: [
    {
      title: "Dashboard",
      path: "/dashboard",
    },
    {
      title: "meilisearch",
      path: "/dashboard/meilisearch",
    },
  ],
};
