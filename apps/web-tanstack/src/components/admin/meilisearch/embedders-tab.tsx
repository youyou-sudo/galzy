import { useQuery } from "@tanstack/react-query";
import { StatusPill } from "@web/components/admin/admin-table";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import { Separator } from "@web/components/ui/separator";
import { Textarea } from "@web/components/ui/textarea";
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import { adminKeys } from "@web/lib/admin/query-keys";
import { cn } from "@web/lib/utils";
import { getEmbedders, updateEmbedders } from "@web/server/admin/meilisearch";
import { CheckCircle2Icon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	CardSkeleton,
	ErrorDisplay,
	extractError,
	ignoreAbort,
	Panel,
	SectionHeader,
} from "./shared";
import type { EmbedderConfig, EmbeddersResponse } from "./types";

/** 提交给服务端的最小配置（与 updateEmbedders 的 validator 对齐） */
type EmbedderPayload = {
	url: string;
	embeddingApiKey: string;
	model: string;
	documentTemplateMaxBytes: number;
	documentTemplate: string;
};

/** 从 API 响应中提取第一个 embedder 配置 */
function parseEmbedder(raw: unknown): EmbedderConfig | null {
	if (!raw || typeof raw !== "object") return null;
	const response = raw as EmbeddersResponse;
	const config =
		response.default ??
		Object.values(response).find(
			(value) => value && typeof value === "object" && "url" in value,
		);
	if (!config || typeof config !== "object") return null;
	return config as EmbedderConfig;
}

/** 乐观更新：把表单内容合并进缓存的 default embedder。 */
function optimisticEmbedders(
	previous: unknown,
	payload: EmbedderPayload,
): unknown {
	const base =
		previous && typeof previous === "object" && !Array.isArray(previous)
			? { ...(previous as Record<string, unknown>) }
			: {};
	const existing =
		base.default && typeof base.default === "object"
			? (base.default as Record<string, unknown>)
			: {};
	base.default = {
		...existing,
		url: payload.url,
		apiKey: payload.embeddingApiKey,
		model: payload.model,
		documentTemplateMaxBytes: payload.documentTemplateMaxBytes,
		documentTemplate: payload.documentTemplate,
	};
	return base;
}

export function EmbeddersTab() {
	const { data, isLoading, isFetching, error, refetch } = useQuery({
		queryKey: adminKeys.meiliEmbedders(),
		queryFn: ignoreAbort(getEmbedders),
	});

	// 表单状态
	const [url, setUrl] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState("");
	const [maxBytes, setMaxBytes] = useState<number | undefined>(undefined);
	const [template, setTemplate] = useState("");

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
		setUrl(serverConfig.url ?? "");
		setApiKey(serverConfig.apiKey ?? "");
		setModel(serverConfig.model ?? "");
		setMaxBytes(serverConfig.documentTemplateMaxBytes);
		setTemplate(serverConfig.documentTemplate ?? "");
	}, [serverConfig, dataFingerprint]);

	const isDirty = useMemo(() => {
		if (!serverConfig) return false;
		return (
			url !== (serverConfig.url ?? "") ||
			apiKey !== (serverConfig.apiKey ?? "") ||
			model !== (serverConfig.model ?? "") ||
			maxBytes !== serverConfig.documentTemplateMaxBytes ||
			template !== (serverConfig.documentTemplate ?? "")
		);
	}, [url, apiKey, model, maxBytes, template, serverConfig]);

	const handleReset = useCallback(() => {
		if (!serverConfig) return;
		setUrl(serverConfig.url ?? "");
		setApiKey(serverConfig.apiKey ?? "");
		setModel(serverConfig.model ?? "");
		setMaxBytes(serverConfig.documentTemplateMaxBytes);
		setTemplate(serverConfig.documentTemplate ?? "");
		toast.info("已还原至服务端配置");
	}, [serverConfig]);

	const saveMutation = useAdminMutation<unknown, EmbedderPayload>({
		mutationFn: (payload) => updateEmbedders({ data: payload }),
		optimistic: (queryClient, payload) => {
			queryClient.setQueryData(adminKeys.meiliEmbedders(), (previous) =>
				optimisticEmbedders(previous, payload),
			);
		},
		affects: [adminKeys.meiliEmbedders()],
		successMessage: "Embedders 配置已更新",
		errorMessage: (error) => `保存失败：${extractError(error)}`,
	});

	const handleSave = () => {
		if (!url || !model) {
			toast.error("请填写 API 端点与模型名称");
			return;
		}
		saveMutation.mutate({
			url,
			embeddingApiKey: apiKey,
			model,
			documentTemplateMaxBytes: maxBytes ?? 0,
			documentTemplate: template,
		});
	};

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
				<CardContent className="pt-2">
					<ErrorDisplay
						message={extractError(error)}
						onRetry={() => refetch()}
					/>
				</CardContent>
			</Card>
		);
	}

	const isSaving = saveMutation.isPending;

	return (
		<Card>
			<CardHeader>
				<SectionHeader
					title="Embedders 配置"
					description="配置 Meilisearch 的嵌入模型，用于语义搜索与向量检索"
					action={
						<div className="flex gap-2 items-center">
							{isSaving && (
								<StatusPill tone="info" icon={SaveIcon} spin>
									保存中
								</StatusPill>
							)}
							{isDirty && !isSaving && (
								<StatusPill tone="warning">有未保存的更改</StatusPill>
							)}
							{isDirty && (
								<Button
									variant="ghost"
									size="sm"
									onClick={handleReset}
									disabled={isSaving}
									className="text-muted-foreground"
								>
									<RotateCcwIcon className="size-3" />
									还原
								</Button>
							)}
						</div>
					}
				/>
			</CardHeader>
			<CardContent
				className={cn(
					"flex flex-col gap-4 transition-opacity duration-200",
					(isFetching || isSaving) && "opacity-70",
				)}
			>
				<Panel className="flex flex-col gap-4">
					<Field orientation="vertical">
						<FieldLabel>
							<FieldTitle>API 端点 URL</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								value={url}
								onChange={(event) => setUrl(event.target.value)}
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
								onChange={(event) => setApiKey(event.target.value)}
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
								onChange={(event) => setModel(event.target.value)}
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
								value={maxBytes ?? ""}
								onChange={(event) => {
									const value = event.target.value;
									setMaxBytes(value === "" ? undefined : Number(value));
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
								onChange={(event) => setTemplate(event.target.value)}
								placeholder={
									"{% for v in vn_datas.titles %}{{ v.title }}{% endfor %}"
								}
								rows={6}
								className="font-mono text-xs"
							/>
							<FieldDescription>
								Liquid 模板语法，用于将文档字段渲染为嵌入文本
							</FieldDescription>
						</FieldContent>
					</Field>
				</Panel>

				<Separator />

				<div className="flex flex-wrap gap-3 items-center">
					<Button onClick={handleSave} disabled={isSaving || !isDirty}>
						<SaveIcon className={cn("size-4", isSaving && "animate-pulse")} />
						保存配置
					</Button>
					{isDirty && !isSaving && (
						<span className="text-xs font-medium text-warning">
							有未保存的更改
						</span>
					)}
					{!isDirty && !isSaving && (
						<span className="flex gap-1.5 items-center text-xs text-muted-foreground">
							<CheckCircle2Icon className="size-3.5 text-success" />
							已是最新配置
						</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
