import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card'
import Link from 'next/link'
import React from 'react'

export default function Youyou() {
  return (
    <article className="flex justify-center items-center">
      <div className="p-4 w-full max-w-md">
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-4xl font-extrabold">
              联系喵喵们
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="text-center space-y-2">
              <h2 className="text-xl font-semibold opacity-80">喵喵喵通知公告</h2>
              <p>
                频道：{' '}
                <Link
                  href="https://t.me/ziyuanlinyin"
                  target="_blank"
                  className="text-blue-500 underline hover:text-blue-700 transition-colors"
                >
                  t.me/ziyuanlinyin
                </Link>
              </p>
            </section>

            <section className="text-center space-y-2">
              <h2 className="text-xl font-semibold opacity-80">问题反馈和合作赞助</h2>
              <p className="">
                邮箱：{' '}
                <Link
                  href="mailto:GalzyAdvertising@proton.me"
                  target="_blank"
                  className="text-blue-500 underline hover:text-blue-700 transition-colors"
                >
                  GalzyAdvertising@proton.me
                </Link>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </article>
  )
}
