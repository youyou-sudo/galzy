import { useForm } from "@tanstack/react-form";
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
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import { useEditorDraft } from "@web/hooks/use-editor-draft";
import { htmlToPlainText, markdownToHtml } from "@web/lib/rich-text";
import { Loader2 } from "lucide-react";
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
}

export function TopicForm({
	defaultValues = { title: "", content: "", contentType: "html" },
	onSubmit,
	draftKey = "galzy:draft:topic:create",
	submitLabel = "发布",
	title = "发帖",
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
											className="text-base h-10"
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
