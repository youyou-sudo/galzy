'use client'

import dynamic from 'next/dynamic'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { visit } from 'unist-util-visit'

const Markdown = dynamic(() => import('react-markdown'), { ssr: false })

let rehypeRawCache: any
let remarkGfmCache: any
let componentsCache: any

export const MarkdownAsync = ({
  readmedata,
  onReady,
}: {
  readmedata: string
  onReady?: () => void
}) => {
  const [plugins, setPlugins] = useState<{
    rehypeRaw?: any
    remarkGfm?: any
    components?: any
  }>({})

  const notifiedRef = useRef(false)

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

  useLayoutEffect(() => {
    if (
      plugins.rehypeRaw &&
      plugins.remarkGfm &&
      plugins.components &&
      !notifiedRef.current
    ) {
      notifiedRef.current = true
      onReady?.()
    }
  }, [plugins, onReady])

  if (!plugins.rehypeRaw || !plugins.remarkGfm || !plugins.components) {
    return null
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
