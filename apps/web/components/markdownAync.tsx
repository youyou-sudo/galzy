'use client'

import { useEffect, useState } from 'react'
import { visit } from 'unist-util-visit'
import dynamic from 'next/dynamic'

// 只动态加载 ReactMarkdown
const Markdown = dynamic(() => import('react-markdown'), { ssr: false })

let rehypeRawCache: any
let remarkGfmCache: any
let componentsCache: any


export const MarkdownAsync = ({ readmedata }: { readmedata: string }) => {
  const [plugins, setPlugins] = useState<{
    rehypeRaw?: any
    remarkGfm?: any
    components?: any
  }>({})

  useEffect(() => {
    if (rehypeRawCache && remarkGfmCache && componentsCache) {
      setPlugins({
        rehypeRaw: rehypeRawCache,
        remarkGfm: remarkGfmCache,
        components: componentsCache,
      })
      return
    }

    Promise.all([
      import('rehype-raw'),
      import('remark-gfm'),
      import('@web/app/(app)/[id]/(components)/markdown-components'),
    ]).then(([rehypeRawMod, remarkGfmMod, componentsMod]) => {
      rehypeRawCache = rehypeRawMod.default
      remarkGfmCache = remarkGfmMod.default
      componentsCache = componentsMod.MarkdownComponents
      setPlugins({
        rehypeRaw: rehypeRawCache,
        remarkGfm: remarkGfmCache,
        components: componentsCache,
      })
    })
  }, [])

  if (!plugins.rehypeRaw || !plugins.remarkGfm || !plugins.components) {
    return <pre>{readmedata}</pre>
  }

  return (
    <Markdown
      remarkPlugins={[plugins.remarkGfm]}
      rehypePlugins={[plugins.rehypeRaw]}
      components={plugins.components}
    >
      {readmedata}
    </Markdown>
  )
}

export function rehypeRemoveBlackWhiteStyles() {
  return (tree: any) => {
    visit(tree, 'element', (node) => {
      if (node.properties?.style) {
        const style = node.properties.style as string

        const newStyle = style
          .split(';')
          .filter((s) => {
            const lower = s.toLowerCase()
            return !(
              lower.includes('color:#000') ||
              lower.includes('color:#000000') ||
              lower.includes('color:#fff') ||
              lower.includes('color:#ffffff') ||
              lower.includes('color:black') ||
              lower.includes('color:white')
            )
          })
          .join(';')

        if (newStyle.trim()) {
          node.properties.style = newStyle
        } else {
          delete node.properties.style
        }
      }
    })
  }
}

export const MarkdownAsyncStrategy = ({ readmedata }: { readmedata: string }) => {
  const [plugins, setPlugins] = useState<{ rehypeRaw?: any; remarkGfm?: any }>({})

  useEffect(() => {
    if (rehypeRawCache && remarkGfmCache) {
      setPlugins({ rehypeRaw: rehypeRawCache, remarkGfm: remarkGfmCache })
      return
    }

    Promise.all([import('rehype-raw'), import('remark-gfm')]).then(
      ([rehypeRawMod, remarkGfmMod]) => {
        rehypeRawCache = rehypeRawMod.default
        remarkGfmCache = remarkGfmMod.default
        setPlugins({ rehypeRaw: rehypeRawCache, remarkGfm: remarkGfmCache })
      },
    )
  }, [])

  if (!plugins.rehypeRaw || !plugins.remarkGfm) return <p>加载中...</p>

  return (
    <Markdown
      rehypePlugins={[plugins.rehypeRaw]}
      remarkPlugins={[plugins.remarkGfm]}
    >
      {readmedata}
    </Markdown>
  )
}
