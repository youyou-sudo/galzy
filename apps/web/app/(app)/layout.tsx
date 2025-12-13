import { AspectRatio } from '@shadcn/ui/components/aspect-ratio'
import { Toaster } from '@shadcn/ui/components/sonner'
import { Footer } from '@web/components/footer'
import { Navbar } from '@web/components/navbar'
import UmamiScript from '@web/components/umami/script'
import { metadataConfig } from '@web/config/metadata'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: {
    template: `%s | ${metadataConfig.stieTitle}`,
    default: metadataConfig.stieTitle,
  },
  description: metadataConfig.description,
}

export default async function YoyoLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {/* 背景层 */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-10"
        style={{ backgroundImage: 'url("/background.webp")' }}
      />

      <div className="flex-1 px-3 pt-2">
        <Navbar />
        {/* 广告 */}
        <aside
          id="sidebar-ad"
          className="flex flex-col mx-auto lg:px-24 max-w-7xl px-4 py-0 mt-2 opacity-80 relative"
        >
          <Link
            data-umami-event="广告点击"
            data-umami-event-name="dzmm"
            data-umami-event-position="Banner-dzmm"
            target="_blank"
            href="https://www.xn--i8s951di30azba.com?rf=876926e5"
          >
            <div id="sidebar-ad" className="sm:hidden">
              <AspectRatio ratio={80 / 9}>
                <Image
                  src="/dzmm.webp"
                  fill
                  alt="dzmm 广告图片"
                  className="object-cover rounded-lg"
                />
              </AspectRatio>
            </div>
            <div id="sidebar-ad" className="hidden sm:block">
              <AspectRatio ratio={120 / 9}>
                <Image
                  src="/dzmm.webp"
                  fill
                  alt="dzmm 广告图片"
                  className="object-cover rounded-lg"
                />
              </AspectRatio>
            </div>
          </Link>
        </aside>
        <div className="flex flex-col mx-auto max-w-7xl space-y-4 py-4 lg:px-0">
          <main>{children}</main>
          <Toaster position="top-center" />
        </div>
      </div>

      <Footer />
      <UmamiScript />
    </>
  )
}
