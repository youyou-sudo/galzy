import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'
import { Separator } from '@web/components/ui/separator'
import { Spinner } from '@web/components/ui/spinner'
import { Textarea } from '@web/components/ui/textarea'
import {
  getEmbedders,
  updateEmbedders,
} from '@web/server/admin/meilisearch'
import { CheckCircle2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ErrorDisplay, ignoreAbort, LoadingSpinner } from './shared'

export function EmbeddersTab() {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['meiliEmbedders'],
    queryFn: ignoreAbort(getEmbedders),
  })

  // 表单状态（本地编辑）
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [maxBytes, setMaxBytes] = useState(0)
  const [template, setTemplate] = useState('')

  // 当数据加载完成后回填表单
  useEffect(() => {
    if (data && typeof data === 'object') {
      const cfg = (data as any).default ?? data
      if (cfg?.url != null) setUrl(cfg.url)
      if (cfg?.embeddingApiKey != null) setApiKey(cfg.embeddingApiKey)
      if (cfg?.model != null) setModel(cfg.model)
      if (cfg?.documentTemplateMaxBytes != null)
        setMaxBytes(cfg.documentTemplateMaxBytes)
      if (cfg?.documentTemplate != null) setTemplate(cfg.documentTemplate)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateEmbedders({
        data: {
          url,
          embeddingApiKey: apiKey,
          model,
          documentTemplateMaxBytes: maxBytes,
          documentTemplate: template,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliEmbedders'] })
      toast.success('Embedders 配置已更新')
    },
    onError: (e: Error) => {
      toast.error(e.message ?? '更新失败')
    },
  })

  if (loading) return <LoadingSpinner text="正在加载 Embedders 配置..." />
  if (error) {
    const msg = error instanceof Error ? error.message : '加载失败'
    return <ErrorDisplay message={msg} onRetry={() => refetch()} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embedders 配置</CardTitle>
        <CardDescription>
          配置 Meilisearch 的嵌入器，用于语义搜索
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="embedder-url">URL</Label>
          <Input
            id="embedder-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.openai.com/v1/embeddings"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="embedder-apikey">API Key</Label>
          <Input
            id="embedder-apikey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="embedder-model">Model</Label>
          <Input
            id="embedder-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="text-embedding-3-small"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="embedder-maxbytes">Document Template Max Bytes</Label>
          <Input
            id="embedder-maxbytes"
            type="number"
            value={maxBytes}
            onChange={(e) => setMaxBytes(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="embedder-template">Document Template</Label>
          <Textarea
            id="embedder-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="{% for v in vn_datas.titles %}{{ v.title }}{% endfor %}"
            rows={6}
          />
        </div>
        <Separator />
        <div className="flex items-center gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Spinner className="size-4 mr-1" />
            ) : (
              <CheckCircle2Icon className="size-4 mr-1" />
            )}
            保存配置
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
