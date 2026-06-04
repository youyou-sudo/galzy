import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Image } from '@unpic/react'
import { Button } from '@web/components/ui/button'
import { CodeBlock } from './code-block'

interface ErrorsProps {
  code: string
  errormessage?: any
}

export default function Errors({ code, errormessage }: ErrorsProps) {
  const navigate = useNavigate()
  const router = useRouter()

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center">
        <Image
          width={400}
          height={400}
          alt={`Request error, error code ${code}`}
          src={`https://http.toshiki.dev/${code}.png`}
          loading="lazy"
          className="rounded-lg"
        />
      </div>

      <h1 className="text-center font-size-4xl text-3xl">Error {code}</h1>

      <div className="flex justify-center space-y-2 gap-2">
        <Link to="/">
          <Button>返回首页</Button>
        </Link>

        {/* 刷新当前页面数据 */}
        <Button
          onClick={() => {
            router.invalidate()
          }}
        >
          刷新
        </Button>

        <Button
          onClick={() => {
            if (window.history.length > 1) {
              navigate({ to: '.' })
            } else {
              navigate({ to: '/' })
            }
          }}
        >
          返回上一页
        </Button>
      </div>

      {errormessage && (
        <div className="w-full max-w-3xl mx-auto">
          <CodeBlock code={JSON.stringify(errormessage, null, 2)} />
        </div>
      )}
    </div>
  )
}
