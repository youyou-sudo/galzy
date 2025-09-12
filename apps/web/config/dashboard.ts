import { Bot, GalleryVerticalEnd, SquareTerminal } from 'lucide-react'

export const dashboardConfig = {
  section: [
    {
      name: 'GalRc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
  ],
  navMain: [
    {
      title: '数据',
      url: '#',
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: '站点配置',
          url: '/dashboard/config',
        },
        {
          title: '数据管理',
          url: '/dashboard/dataManagement',
        },
        {
          title: 'Tag',
          url: '/dashboard/tag',
        },
      ],
    },
    {
      title: '基建',
      url: '#',
      icon: Bot,
      items: [
        {
          title: '下载管理',
          url: '/dashboard/download',
        },
      ],
    },
  ],
  user: {
    name: 'Skyleen',
    email: 'skyleen@example.com',
    avatar:
      'https://pbs.twimg.com/profile_images/1909615404789506048/MTqvRsjo_400x400.jpg',
  },
}
