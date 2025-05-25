import {
  Bot,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  SquareTerminal,
} from "lucide-react";

export const dashboardConfig = {
  section: [
    {
      name: "GalRc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
  ],
  navMain: [
    {
      title: "数据",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "补充数据",
          url: "/dashboard/other",
        },
      ],
    },
    {
      title: "基建",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "下载管理",
          url: "/dashboard/download",
        },
        {
          title: "任务管理",
          url: "/dashboard/task",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
  user: {
    name: "Skyleen",
    email: "skyleen@example.com",
    avatar:
      "https://pbs.twimg.com/profile_images/1909615404789506048/MTqvRsjo_400x400.jpg",
  },
};
