import { Alert, AlertDescription, AlertTitle } from '@web/components/ui/alert'
import { BadgeJapaneseYen, Info } from 'lucide-react'
import Link from 'next/link'

export const Glgczujm = () => {
  const glgc = [
    {
      name: '从雨云',
      url: 'https://congyu.moe/auth/register?invite=048e5cbcac',
      desc: '柚子厨专属 VPN, 中转高速流量，低延迟，流媒体全解锁，又有 0.1 低倍率流量 9 元 1 TB',
      info: '使用 0.1 等低倍率节点下载资源，请调整下载线程为 1 以获得最快下载速度',
    },
    {
      name: '魔法喵',
      url: 'https://mofacga.top/register?code=Vg1GGQiP',
      desc: '价格实惠、最低 9.9￥- 768 GB 流量、中转高速、GPT & 流媒体解锁',
    },
    {
      name: 'MujikaNetwork',
      url: 'https://www.mujika.cloud/#/register?code=G0Udwpw2',
      desc: 'IEPL专线接入，超低延迟无惧晚高峰、流媒体/AI全解锁、覆盖主流地区节点、设有机场EMBY服（标准订阅计划及以上可享），跨境快车道，就用母鸡卡！',
    },
  ]
  return (
    <div className='space-y-1'>
      <Alert className="border-cyan-600/30 text-cyan-500 border-x-0">
        <Info className="w-4 h-4" />
        <AlertTitle>
          本站已配置负载均衡保证速度
        </AlertTitle>
        <AlertDescription>
          推荐使用 IDM 等工具喵～
        </AlertDescription>
      </Alert>
      <Alert className="border-cyan-600/30 border-x-0 border-b-0">
        <BadgeJapaneseYen className="w-4 h-4" />
        <AlertTitle>
          如无法下载 / 速度慢，这里推荐机场
        </AlertTitle>
        <AlertDescription>
          <ul className="list-inside list-disc text-sm space-y-3">
            {glgc.map((item, index) => {
              return (
                <li key={index}>
                  <Link
                    className="underline hover:text-cyan-600"
                    target="_blank"
                    href={item.url}
                  >
                    {item.name}：{item.desc}
                  </Link>
                  {item.info && (
                    <p className="text-xs ml-4 opacity-55">{item.info}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}
