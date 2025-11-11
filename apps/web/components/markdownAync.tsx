'use client'

import { useEffect, useState } from 'react'
import { visit } from 'unist-util-visit'
import dynamic from 'next/dynamic'

// 只动态加载 ReactMarkdown
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })

interface MarkdownProps {
  readmedata: string
}

export const MarkdownAsync = ({ readmedata }: MarkdownProps) => {
  const [plugins, setPlugins] = useState<{ rehypeRaw?: any; remarkGfm?: any; components?: any }>({})

  useEffect(() => {
    let mounted = true
    // 动态加载插件和 components
    Promise.all([
      import('rehype-raw'),
      import('remark-gfm'),
      import('@web/app/(app)/[id]/(components)/markdown-components')
    ]).then(([rehypeRawMod, remarkGfmMod, componentsMod]) => {
      if (mounted) {
        setPlugins({
          rehypeRaw: rehypeRawMod.default,
          remarkGfm: remarkGfmMod.default,
          components: componentsMod.MarkdownComponents
        })
      }
    })

    return () => { mounted = false }
  }, [])

  // SSR 或插件/组件未加载时显示占位
  if (!plugins.rehypeRaw || !plugins.remarkGfm || !plugins.components) {
    return <pre>{readmedata}</pre>
  }

  return (
    <ReactMarkdown
      remarkPlugins={[plugins.remarkGfm]}
      rehypePlugins={[plugins.rehypeRaw]}
      components={plugins.components}
    >
      {readmedata}
    </ReactMarkdown>
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

export const MarkdownAsyncStrategy = ({ readmedata }: MarkdownProps) => {
  const [plugins, setPlugins] = useState<{ rehypeRaw?: any; remarkGfm?: any; components?: any }>({})

  useEffect(() => {
    let mounted = true
    // 动态加载插件和 components
    Promise.all([
      import('rehype-raw'),
      import('remark-gfm'),
    ]).then(([rehypeRawMod, remarkGfmMod]) => {
      if (mounted) {
        setPlugins({
          rehypeRaw: rehypeRawMod.default,
          remarkGfm: remarkGfmMod.default,
        })
      }
    })

    return () => { mounted = false }
  }, [])

  // SSR 或插件/组件未加载时显示占位
  if (!plugins.rehypeRaw || !plugins.remarkGfm || !plugins.components) {
    return <pre>{readmedata}</pre>
  }

  return (
    <ReactMarkdown
      remarkPlugins={[plugins.remarkGfm]}
      rehypePlugins={[plugins.rehypeRaw, rehypeRemoveBlackWhiteStyles]}
    >
      {readmedata}
    </ReactMarkdown>
  )
}
