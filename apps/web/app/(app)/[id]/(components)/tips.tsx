import { Alert, AlertDescription, AlertTitle } from '@web/components/ui/alert'
import { AspectRatio } from '@web/components/ui/aspect-ratio'
import { BadgeJapaneseYen, Info } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const glgc = [
  {
    name: '魔法喵',
    url: 'https://mofacga.top/register?code=Vg1GGQiP',
    desc: '价格实惠、最低 9.9￥- 768 GB 流量、中转高速、GPT & 流媒体解锁',
  },
  {
    name: '从雨云',
    url: 'https://congyu.moe/auth/register?invite=048e5cbcac',
    desc: '柚子厨专属 VPN, 中转高速流量，低延迟，流媒体全解锁，又有 0.1 低倍率流量 9 元 1 TB',
    info: '使用 0.1 等低倍率节点下载资源，请调整下载线程为 1 以获得最快下载速度',
  },
  {
    name: 'MujikaNetwork',
    url: 'https://my.mujika.pro/#/register?code=G0Udwpw2',
    desc: 'IEPL专线接入，超低延迟无惧晚高峰、流媒体/AI全解锁、覆盖主流地区节点、设有机场EMBY服（标准订阅计划及以上可享），跨境快车道，就用母鸡卡！',
  },
]

// 页内广告
export const Glgczujm = () => {
  return (
    <div className="space-y-1 mt-4 p-1">
      <Alert className="border-cyan-600/30 text-cyan-500 border-x-0 border-b-0">
        <Info className="w-4 h-4" />
        <AlertTitle>本站已配置负载均衡保证速度喵～</AlertTitle>
        <AlertDescription>
          <li>
            对于大文件，我们建议使用 IDM 或 Aria2
            在一个小时内下载完成以防止中断喵～
          </li>
          <br />
          <li>
            PC 端使用 WinRAR | 移动端使用 RAR / ZArchiver 等专业工具喵～;
            不要使用非正规解压工具，避免文件损坏喵～
          </li>
          <br />
          游戏主程序建议存放在全英文路径下喵～
          <br />
          <li>
            如果您喜欢这个并且能够负担得起，请考虑购买原版，或直接支持作者喵～
          </li>
        </AlertDescription>
      </Alert>

      <aside>
        <Alert
          id="sidebar-ad"
          className="border-cyan-600/30 border-x-0 border-b-0 pb-0 flex items-center gap-2"
        >
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-100 text-lg opacity-60"
            aria-hidden="true"
          >
            🍚
          </span>

          <Link
            target="_blank"
            data-umami-event="广告点击"
            data-umami-event-name="DZMM"
            data-umami-event-position="页内广告-DZMM"
            href="https://www.xn--i8s951di30azba.com?rf=876926e5"
          >
            <AlertTitle>Ai 女友💋（在线畅玩）</AlertTitle>
          </Link>
        </Alert>
      </aside>

      <div className="lg:px-5 lg:w-[80%] px-4 py-0 opacity-80">
        <Link
          target="_blank"
          data-umami-event="广告点击"
          data-umami-event-name="DZMM"
          data-umami-event-position="页内广告-DZMM"
          href="https://www.xn--i8s951di30azba.com?rf=876926e5"
        >
          <div className="sm:hidden">
            <AspectRatio ratio={80 / 9}>
              <Image
                src="/dzmm.webp"
                fill
                alt="DZMM 广告图片"
                className="object-cover rounded-lg"
              />
            </AspectRatio>
          </div>
          <div className="hidden sm:block">
            <AspectRatio ratio={120 / 9}>
              <Image
                src="/dzmm.webp"
                fill
                alt="DZMM 广告图片"
                className="object-cover rounded-lg"
              />
            </AspectRatio>
          </div>
        </Link>
      </div>

      <aside>
        <Alert
          id="sidebar-ad"
          className="border-cyan-600/30 border-x-0 border-b-0 flex items-start gap-3"
        >
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-100 text-lg opacity-60"
            aria-hidden="true"
          >
            🍚
          </span>

          <div className="space-y-2">
            <AlertTitle>如无法下载 / 速度慢，这里推荐机场</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-sm space-y-3">
                {glgc.map((item, index) => (
                  <li key={index}>
                    <Link
                      data-umami-event="广告点击"
                      data-umami-event-name={item.name}
                      data-umami-event-position={`页内广告-${item.name}`}
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
                ))}
              </ul>
            </AlertDescription>
          </div>
        </Alert>
      </aside>
    </div>
  )
}

// 下载框广告
export const GlgczujmDl = () => {
  return (
    <aside className="rounded-2xl border border-cyan-600/30 bg-cyan-50/10 p-4 shadow-sm dark:bg-cyan-950/20 dark:border-cyan-500/20">
      <div className="space-y-3">
        <p className="text-sm font-medium flex items-center text-cyan-900 dark:text-cyan-100">
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-100 text-lg opacity-60 mr-2"
            aria-hidden="true"
          >
            🍚
          </span>
          如无法下载 / 速度慢，这里推荐机场
        </p>

        <AlertDescription>
          <ul className="list-inside list-disc text-sm space-y-2 text-gray-700 dark:text-gray-300">
            {glgc.map((item, index) => (
              <li key={index}>
                <Link
                  data-umami-event="广告点击"
                  data-umami-event-name={item.name}
                  data-umami-event-position={`页内广告-${item.name}`}
                  className="underline decoration-dotted underline-offset-2 hover:text-cyan-600 transition-colors"
                  target="_blank"
                  href={item.url}
                >
                  {item.name}：{item.desc}
                </Link>
                {item.info && (
                  <p className="text-xs ml-5 mt-1 opacity-70 leading-snug">
                    {item.info}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </div>
    </aside>
  )
}
