import { Footer } from '@web/components/footer'
import { Navbar } from '@web/components/navbar'
import UmamiScript from '@web/components/umami/script'
import { metadataConfig } from '@web/config/metadata'
import type { Metadata } from 'next'

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

      <main className="flex-1 px-3">
        <Navbar />
        <div className="flex flex-col  mx-auto max-w-7xl  space-y-4 px-4 py-4 lg:px-0">
          {children}
        </div>
      </main>

      <Footer />
      <UmamiScript />
    </>
  )
}
