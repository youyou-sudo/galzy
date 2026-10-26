import { useForm } from "@tanstack/react-form";
import { EditorDraftBanner } from "@web/components/EditorDraftBanner";
import { RichTextEditor } from "@web/components/editor/RichTextEditor";
import { PageHeader } from "@web/components/shared/page-header";
import { Button } from "@web/components/ui/button";
import { Card, CardContent } from "@web/components/ui/card";
import {
	Field,
	FieldContent,
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import { useEditorDraft } from "@web/hooks/use-editor-draft";
import { htmlToPlainText, markdownToHtml } from "@web/lib/rich-text";
import { FileText, Loader2 } from "lucide-react";
import { useMemo } from "react";

interface TopicFormProps {
	defaultValues?: {
		title: string;
		content: string;
		contentType?: "markdown" | "html";
	};
	onSubmit: (values: {
		title: string;
		content: string;
		contentType: "markdown" | "html";
	}) => Promise<void>;
	/** 草稿存储 key：新建 / 不同帖子编辑各用独立 key，避免互相覆盖 */
	draftKey?: string;
	submitLabel?: string;
	title?: string;
	description?: string;
	/** 页头图标：发帖用默认，编辑传 PenLine */
	icon?: typeof FileText;
}

/**
 * 发帖 / 编辑帖子共用的表单。
 *
 * 页头走统一 PageHeader（与论坛列表、详情同源），表单卡片沿用 ui/card 的
 * rounded-2xl + 发丝边；字段与主按钮的间距、高度在全站统一（h-9 / gap-5）。
 */
export function TopicForm({
	defaultValues = { title: "", content: "", contentType: "html" },
	onSubmit,
	draftKey = "galzy:draft:topic:create",
	submitLabel = "发布",
	title = "发帖",
	description,
	icon = FileText,
}: TopicFormProps) {
	// 存量 Markdown 内容先转成 HTML 再进编辑器；编辑器始终产出 HTML。
	const editorInitial = useMemo(
		() =>
			defaultValues.contentType === "markdown"
				? markdownToHtml(defaultValues.content)
				: defaultValues.content,
		[defaultValues.content, defaultValues.contentType],
	);

	const form = useForm({
		defaultValues: {
			title: defaultValues.title,
			content: editorInitial,
			contentType: "html" as "markdown" | "html",
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
			await onSubmit({
				title: value.title.trim(),
				content,
				contentType: "html",
			});
			// 提交成功（父组件导航离开）→ 清除草稿，避免下次打开误弹恢复
			draft.clear();
		},
	});

	const draft = useEditorDraft({
		key: draftKey,
		active: true,
		subscribe: (listener) => form.store.subscribe(listener).unsubscribe,
		getValues: () => {
			const v = form.state.values;
			return { title: v.title, content: v.content };
		},
		getInitial: () => ({
			title: defaultValues.title,
			content: editorInitial,
		}),
	});

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			form.handleSubmit();
		}
	};

	return (
		<div className="mx-auto w-full max-w-4xl">
			<PageHeader icon={icon} title={title} description={description} />

			<Card className="py-0">
				<CardContent className="px-4 py-5 sm:px-6">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							void form.handleSubmit();
						}}
						className="flex flex-col gap-5"
					>
						{draft.offered && (
							<EditorDraftBanner
								savedAt={draft.offered.savedAt}
								onRestore={() => {
									form.reset({
										title: draft.offered!.title,
										content: draft.offered!.content,
										contentType: "html",
									});
									draft.restore();
								}}
								onDiscard={draft.discard}
							/>
						)}

						<form.Field name="title">
							{(field) => (
								<Field orientation="vertical">
									<FieldLabel>
										<FieldTitle>标题</FieldTitle>
									</FieldLabel>
									<FieldContent>
										<Input
											placeholder="输入帖子标题"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
										/>
									</FieldContent>
								</Field>
							)}
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
												placeholder="输入帖子内容喵～（Ctrl+Enter 提交）"
												aria-invalid={isInvalid}
												minHeight={500}
											/>
										</FieldContent>
									</Field>
								);
							}}
						</form.Field>

						<div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-end">
							<p className="text-xs text-muted-foreground sm:mr-auto">
								Ctrl/⌘ + Enter 快速提交，草稿会自动保存
							</p>
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button
										type="submit"
										size="lg"
										className="w-full sm:w-auto"
										disabled={isSubmitting}
									>
										{isSubmitting ? (
											<>
												<Loader2 className="size-4 animate-spin" aria-hidden="true" />
												提交中...
											</>
										) : (
											submitLabel
										)}
									</Button>
								)}
							</form.Subscribe>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
