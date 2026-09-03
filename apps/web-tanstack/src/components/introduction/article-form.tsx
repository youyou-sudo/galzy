import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EditorDraftBanner } from "@web/components/EditorDraftBanner";
import { RichTextEditor } from "@web/components/editor/RichTextEditor";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import {
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import { useEditorDraft } from "@web/hooks/use-editor-draft";
import { elysiaErrorF } from "@web/lib";
import { htmlToPlainText, markdownToHtml } from "@web/lib/rich-text";
import { authClient } from "@web/server/auth/auth-client";
import {
	createIntroduction,
	updateIntroduction,
} from "@web/server/introduction";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

interface ArticleFormProps {
	/** 创建模式：目标游戏 ID */
	gameId?: string;
	/** 编辑模式：文章 ID */
	articleId?: string;
	/** 编辑模式初始数据 */
	initialData?: {
		title?: string;
		content?: string;
		contentType?: "markdown" | "html";
		copyright?: string;
	};
	/**
	 * 自定义提交函数（用于 admin 等非 introduction 场景）。
	 * 提供后跳过内置的 createIntroduction/updateIntroduction 与 session 获取。
	 */
	customSubmit?: (values: {
		title: string;
		content: string;
		contentType: "markdown" | "html";
		copyright?: string;
	}) => Promise<void>;
	/** 草稿存储 key（创建 / 编辑各自独立） */
	draftKey: string;
	title?: string;
	submitLabel?: string;
	/** 提交成功回调（由路由负责跳转） */
	onSuccess?: () => void;
}

export function ArticleForm({
	gameId,
	articleId,
	initialData,
	customSubmit,
	draftKey,
	title = "攻略文章",
	submitLabel = "提交",
	onSuccess,
}: ArticleFormProps) {
	const isEdit = !!articleId;
	const isCustom = !!customSubmit;

	// 存量 Markdown 内容先转成 HTML 再进编辑器；编辑器始终产出 HTML。
	const editorInitial = useMemo(
		() =>
			initialData?.contentType === "markdown"
				? markdownToHtml(initialData.content ?? "")
				: (initialData?.content ?? ""),
		[initialData?.content, initialData?.contentType],
	);

	const form = useForm({
		defaultValues: {
			title: initialData?.title ?? "",
			content: editorInitial,
			contentType: "html" as "markdown" | "html",
			copyright: initialData?.copyright ?? "",
		},
		onSubmit: async ({ value }) => {
			const content = value.content.trim();
			if (htmlToPlainText(content).length === 0) {
				form.setFieldMeta("content", (m) => ({
					...m,
					errors: ["内容是空的喵？"],
					isTouched: true,
				}));
				return;
			}

			if (isCustom) {
				await customSubmit({
					title: value.title.trim(),
					content,
					contentType: "html",
					copyright: value.copyright?.trim() || undefined,
				});
				draft.clear();
				return;
			}

			if (!session?.user?.id) {
				toast.error("请先登录喵～");
				return;
			}

			if (isEdit && articleId) {
				await updateMutation.mutateAsync({
					data: {
						id: articleId,
						data: {
							title: value.title.trim(),
							content,
							contentType: "html",
							copyright: value.copyright?.trim() || null,
						},
					},
				});
				return;
			}
			if (!gameId) {
				toast.error("缺少游戏 ID，无法创建喵～");
				return;
			}
			await createMutation.mutateAsync({
				data: {
					gameId,
					title: value.title.trim(),
					content,
					contentType: "html",
					copyright: value.copyright?.trim() || null,
				},
			});
			form.reset();
		},
	});

	// ── 获取用户 session（customSubmit 不需要） ──────────────────
	const { data: session } = useQuery({
		queryKey: ["auth"],
		queryFn: async () => {
			const { data: res, error } = await authClient.getSession();
			elysiaErrorF(error);
			return res;
		},
		enabled: !isCustom,
	});

	const isAdmin = session?.user?.role === "admin" || isCustom;

	// ── Mutations（customSubmit 时跳过） ──────────────────────────
	const createMutation = useMutation({
		mutationFn: createIntroduction,
		onSuccess: () => {
			draft.clear();
			toast.success(
				isAdmin ? "文章创建成功～" : "已提交审核，请等待管理员审核喵～",
			);
			onSuccess?.();
		},
		onError: (error: any) => {
			toast.error(error?.message || "创建失败，请稍后重试");
		},
	});

	const updateMutation = useMutation({
		mutationFn: updateIntroduction,
		onSuccess: () => {
			draft.clear();
			toast.success(
				isAdmin ? "文章更新成功～" : "修改已提交，请等待管理员重新审核喵～",
			);
			onSuccess?.();
		},
		onError: (error: any) => {
			toast.error(error?.message || "更新失败，请稍后重试");
		},
	});

	// ── Ctrl+Enter 提交快捷键 ─────────────────────────────────────
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			form.handleSubmit();
		}
	};

	// ── 崩溃防丢草稿 ─────────────────────────────────────────────
	const draft = useEditorDraft({
		key: draftKey,
		active: true,
		subscribe: (listener) => form.store.subscribe(listener).unsubscribe,
		getValues: () => {
			const v = form.state.values;
			return { title: v.title, content: v.content };
		},
		getInitial: () => ({
			title: initialData?.title ?? "",
			content: editorInitial,
		}),
	});

	return (
		<div className="w-full max-w-7xl mx-auto">
			<Card>
				<CardHeader>
					<CardTitle className="text-xl">{title}</CardTitle>
				</CardHeader>
				<CardContent className="p-6">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							void form.handleSubmit();
						}}
						className="flex flex-col gap-6"
					>
						{draft.offered && (
							<EditorDraftBanner
								savedAt={draft.offered.savedAt}
								onRestore={() => {
									form.reset({
										title: draft.offered!.title,
										content: draft.offered!.content,
										contentType: "html",
										copyright: initialData?.copyright ?? "",
									});
									draft.restore();
								}}
								onDiscard={draft.discard}
							/>
						)}

						<form.Field name="title">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched &&
									(field.state.meta.errors?.length ?? 0) > 0;
								return (
									<Field orientation="vertical">
										<FieldLabel>
											<FieldTitle>标题</FieldTitle>
										</FieldLabel>
										<FieldContent>
											<Input
												placeholder="输入文章标题喵～"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												className="text-base h-10"
											/>
											{isInvalid && (
												<FieldError
													className="text-xs"
													errors={field.state.meta.errors}
												/>
											)}
										</FieldContent>
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="content">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched &&
									(field.state.meta.errors?.length ?? 0) > 0;
								return (
									<Field orientation="vertical">
										<FieldLabel>
											<FieldTitle>内容</FieldTitle>
										</FieldLabel>
										<FieldContent>
											<RichTextEditor
												value={field.state.value}
												onChange={(val) => field.handleChange(val)}
												onKeyDown={handleKeyDown}
												placeholder="输入文章喵～（Ctrl+Enter 提交）"
												aria-invalid={isInvalid}
												minHeight={500}
											/>
											{isInvalid && (
												<FieldError
													className="text-xs"
													errors={field.state.meta.errors}
												/>
											)}
										</FieldContent>
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="copyright">
							{(field) => (
								<Field orientation="vertical">
									<FieldLabel>
										<FieldTitle>来源</FieldTitle>
									</FieldLabel>
									<FieldContent>
										<Input
											placeholder="输入文章来源，如果有的话喵～"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											autoComplete="off"
											className="text-base h-10"
										/>
									</FieldContent>
								</Field>
							)}
						</form.Field>

						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<Button
									type="submit"
									className="w-full"
									disabled={isSubmitting}
								>
									{isSubmitting ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											提交中...
										</>
									) : (
										submitLabel
									)}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
