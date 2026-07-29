import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@web/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@web/components/ui/field';
import { Input } from '@web/components/ui/input';
import { Separator } from '@web/components/ui/separator';
import { Spinner } from '@web/components/ui/spinner';
import { Textarea } from '@web/components/ui/textarea';
import { getEmbedders, updateEmbedders } from '@web/server/admin/meilisearch';
import { CheckCircle2Icon, RotateCcwIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EmbedderConfig, EmbeddersResponse } from './types';
import { CardSkeleton, ErrorDisplay, extractError, ignoreAbort } from './shared';

/** 从 API 响应中提取第一个 embedder 配置 */
function parseEmbedder(raw: unknown): EmbedderConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const resp = raw as EmbeddersResponse;
  // 取 default 或第一个 embedder
  const cfg = resp.default ?? Object.values(resp).find((v) => v && typeof v === 'object' && 'url' in v);
  if (!cfg || typeof cfg !== 'object') return null;
  return cfg as EmbedderConfig;
}

export function EmbeddersTab() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['meiliEmbedders'],
    queryFn: ignoreAbort(getEmbedders),
  });

  // 表单状态
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [maxBytes, setMaxBytes] = useState<number | undefined>(undefined);
  const [template, setTemplate] = useState('');

  const serverConfig = useMemo(() => parseEmbedder(data), [data]);
  const dataFingerprint = useMemo(
    () => (serverConfig ? JSON.stringify(serverConfig) : null),
    [serverConfig],
  );
  const lastFingerprintRef = useRef<string | null>(null);

  // 仅在服务端数据变化时回填表单（非用户编辑导致的 refetch）
  useEffect(() => {
    if (!serverConfig) return;
    if (lastFingerprintRef.current === dataFingerprint) return;
    lastFingerprintRef.current = dataFingerprint;
    setUrl(serverConfig.url ?? '');
    setApiKey(serverConfig.apiKey ?? '');
    setModel(serverConfig.model ?? '');
    setMaxBytes(serverConfig.documentTemplateMaxBytes);
    setTemplate(serverConfig.documentTemplate ?? '');
  }, [serverConfig, dataFingerprint]);

  const isDirty = useMemo(() => {
    if (!serverConfig) return false;
    return (
      url !== (serverConfig.url ?? '') ||
      apiKey !== (serverConfig.apiKey ?? '') ||
      model !== (serverConfig.model ?? '') ||
      maxBytes !== serverConfig.documentTemplateMaxBytes ||
      template !== (serverConfig.documentTemplate ?? '')
    );
  }, [url, apiKey, model, maxBytes, template, serverConfig]);

  const handleReset = useCallback(() => {
    if (!serverConfig) return;
    setUrl(serverConfig.url ?? '');
    setApiKey(serverConfig.apiKey ?? '');
    setModel(serverConfig.model ?? '');
    setMaxBytes(serverConfig.documentTemplateMaxBytes);
    setTemplate(serverConfig.documentTemplate ?? '');
    toast.info('已还原至服务端配置');
  }, [serverConfig]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateEmbedders({
        data: {
          url: url || '',
          embeddingApiKey: apiKey,
          model: model || '',
          documentTemplateMaxBytes: maxBytes ?? 0,
          documentTemplate: template || '',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliEmbedders'] });
      toast.success('Embedders 配置已更新');
    },
    onError: (e: unknown) => {
      toast.error(extractError(e));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardSkeleton rows={5} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorDisplay
            message={extractError(error)}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Embedders 配置</CardTitle>
            <CardDescription>
              配置 Meilisearch 的嵌入模型，用于语义搜索与向量检索
            </CardDescription>
          </div>
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground shrink-0"
            >
              <RotateCcwIcon className="size-3" />
              还原
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field orientation="vertical">
          <FieldLabel>
            <FieldTitle>API 端点 URL</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.openai.com/v1/embeddings"
            />
            <FieldDescription>
              OpenAI 兼容的 Embeddings API 地址
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field orientation="vertical">
          <FieldLabel>
            <FieldTitle>API Key</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </FieldContent>
        </Field>

        <Field orientation="vertical">
          <FieldLabel>
            <FieldTitle>模型名称</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="text-embedding-3-small"
            />
            <FieldDescription>
              如 text-embedding-3-small, bge-large-zh-v1.5 等
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field orientation="vertical">
          <FieldLabel>
            <FieldTitle>文档模板最大字节数</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input
              type="number"
              value={maxBytes ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setMaxBytes(v === '' ? undefined : Number(v));
              }}
              placeholder="0 = 无限制"
            />
            <FieldDescription>
              单个文档嵌入时的最大字节数，0 表示无限制
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field orientation="vertical">
          <FieldLabel>
            <FieldTitle>文档模板</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={'{% for v in vn_datas.titles %}{{ v.title }}{% endfor %}'}
              rows={6}
              className="font-mono text-xs"
            />
            <FieldDescription>
              Liquid 模板语法，用于将文档字段渲染为嵌入文本
            </FieldDescription>
          </FieldContent>
        </Field>

        <Separator />

        <div className="flex items-center gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
          >
            {saveMutation.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <CheckCircle2Icon className="size-4" />
            )}
            保存配置
          </Button>
          {isDirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              有未保存的更改
            </span>
          )}
          {!isDirty && !saveMutation.isPending && (
            <span className="text-xs text-muted-foreground">
              已是最新配置
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
