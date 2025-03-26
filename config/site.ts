export type SiteConfig = typeof siteConfig;

import {
  Settings,
  HelpCircle,
  Bell,
  FolderSearch,
  LayoutTemplate,
} from "lucide-react";
import type { MenuItem } from "@/types/dataClass";

export const siteConfig = {
  name: "VNDL",
  description:
    "又又又一个视觉小说资源站喵～；收录各种恋爱养成游戏、美少女游戏(ACGgame, Galgame)、二次元视觉小说等ACG领域资源的类别。提供游戏简介，讨论，资源下载。",
  keywords: [
    "Galgame",
    "美少女游戏",
    "二次元视觉小说",
    "ギャルゲーム",
    "ACGgame",
    "Visual Novel",
    "视觉小说",
    "VNGet",
    "Visual Novel Download",
    "Galgame Download",
    "ACGgame Download",
    "Game Download",
    "Galgame 下载",
    "视觉小说 下载",
    "二次元视觉小说 下载",
    "ギャルゲーム 下载",
    "Galgame 免费下载",
    "新作 Galgame",
    "经典 Visual Novel",
    "热门 Galgame",
    "冷门 Galgame",
    "PC版 Galgame",
    "iOS Visual Novel 下载",
    "安卓 Visual Novel 下载",
    "Kirikiri Galgame",
    "Tyranor Galgame",
    "ONScripter Galgame",
    "Ren'Py Galgame",
    "汉化版 Visual Novel",
    "同人 Galgame",
  ],
};

// 主菜单数据
export const mainMenuItems: MenuItem[] = [
  {
    id: "dashboard",
    title: "仪表盘",
    icon: LayoutTemplate,
    path: "/dashboard",
  },
  {
    id: "meilisearch",
    title: "Meilisearch",
    icon: FolderSearch,
    path: "/dashboard/meilisearch",
  },
  // {
  //   id: "documents",
  //   title: "数据",
  //   icon: Database,
  //   path: "#",
  //   children: [
  //     {
  //       id: "vndb",
  //       title: "VNDB",
  //       icon: DatabaseBackup,
  //       path: "/dashboard/vndb",
  //     },
  //   ],
  // },
  {
    id: "notifications",
    title: "通知",
    icon: Bell,
    path: "/notifications",
  },
];

// 设置菜单数据
export const settingsMenuItems: MenuItem[] = [
  {
    id: "settings",
    title: "网站设置",
    icon: Settings,
    path: "/settings",
  },
  {
    id: "help",
    title: "帮助",
    icon: HelpCircle,
    path: "/help",
  },
];
