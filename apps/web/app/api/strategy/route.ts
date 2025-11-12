import { api } from '@libs'

const vltdma = {
  code: 400,
  getMessage(type: 'notFound' | 'noFiles') {
    const messages = {
      notFound: {
        message: '喵喵什么都不知道喵，请提供正确的游戏 ID 喵～',
        code: '400',
      },
      noFiles: {
        message: '喵喵什么都不知道喵，请提供正确的游戏 ID 喵～',
        code: '400',
      },
    }
    return messages[type]
  },
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const vid = searchParams.get('vid')

  if (!vid) {
    return new Response(JSON.stringify(vltdma.getMessage('notFound')), {
      status: vltdma.code,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const strategyList = await api.strategy.gamestrategys.get({
    query: { gameId: vid },
  })
  if (strategyList.status >= 400) {
    return new Response(JSON.stringify(vltdma.getMessage('notFound')), {
      status: vltdma.code,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = strategyList.data
  const res = {
    code: 200,
    message: 'success',
    data,
  }
  return Response.json(res)
}
