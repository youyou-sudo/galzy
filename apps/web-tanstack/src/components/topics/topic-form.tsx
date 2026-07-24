import { useForm } from "@tanstack/react-form";
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
import { Textarea } from "@web/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface TopicFormProps {
	defaultValues?: {
		title: string;
		content: string;
	};
	onSubmit: (values: { title: string; content: string }) => Promise<void>;
	submitLabel?: string;
	title?: string;
}

export function TopicForm({
	defaultValues = { title: "", content: "" },
	onSubmit,
	submitLabel = "发布",
	title = "发帖",
}: TopicFormProps) {
	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			await onSubmit(value);
		},
	});

	return (
		<Card className="w-full max-w-2xl mx-auto">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
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
						{(field) => (
							<Field orientation="vertical">
								<FieldLabel>
									<FieldTitle>内容</FieldTitle>
								</FieldLabel>
								<FieldContent>
									<Textarea
										placeholder="输入帖子内容"
										rows={8}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
								</FieldContent>
							</Field>
						)}
					</form.Field>

					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" className="w-full" disabled={isSubmitting}>
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
	);
}
