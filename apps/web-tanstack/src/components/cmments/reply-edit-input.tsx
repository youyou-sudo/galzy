import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { Image } from "@unpic/react";
import { Field, FieldError, FieldGroup } from "@web/components/ui/field";
import { elysiaErrorF } from "@web/lib";
import { authClient } from "@web/server/auth/auth-client";
import { createCmments } from "@web/server/comments";
import { replyCardStore, replycardActions } from "@web/stores/reply-edit-input";
import { PawPrint } from "lucide-react";
import { type ComponentProps, useMemo, useRef } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import KaomojiPicker from "../EmojiPicker/emoji-picker";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

const items = [
	{ label: "讨论", value: "comment" },
	{ label: "提问", value: "question" },
	{ label: "反馈", value: "feedback" },
] as const;

/** base-ui ToggleGroup 的 Value 泛型在 type="single" 下推断不稳定，
 *  集中定型 props（value 单值、onValueChange 归一化后写回表单字段）。 */
function typeToggleProps(field: {
	name: string;
	state: { value: unknown };
	handleChange: (value: never) => void;
}) {
	return {
		type: "single" as const,
		size: "sm" as const,
		id: field.name,
		value: field.state.value as unknown as string,
		variant: "outline" as const,
		spacing: 2,
		onValueChange: (value: string | string[] | null | undefined) => {
			if (
				Array.isArray(value)
					? value.length > 0
					: value !== null && value !== undefined
			) {
				field.handleChange((Array.isArray(value) ? value[0] : value) as never);
			}
		},
	};
}

export const ReplyEidtInput = ({
	reId,
	targetType,
	targetId,
	commentscomp,
	showTypeSelector = true,
}: {
	reId?: string;
	targetType: string;
	targetId: string;
	commentscomp: boolean;
	showTypeSelector?: boolean;
}) => {
	const formId = `reply-edit-form-${reId}-${targetId}`;
	const cursorPosRef = useRef({ start: 0, end: 0 });

	const data = useSelector(replyCardStore, (s) => s.data);
	const openReId = useSelector(replyCardStore, (s) => s.openReId);

	const formSchema = useMemo(
		() =>
			showTypeSelector
				? z.object({
						comments: z
							.string()
							.check(
								z.minLength(1, "说点什么喵～"),
								z.maxLength(2000, "2000 字作文喵喵记不住喵"),
							),
						type: z.enum(items.map((i) => i.value) as [string, ...string[]]),
					})
				: z.object({
						comments: z
							.string()
							.check(
								z.minLength(1, "说点什么喵～"),
								z.maxLength(2000, "2000 字作文喵喵记不住喵"),
							),
					}),
		[showTypeSelector],
	);

	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: createCmments,
		onError: () => {
			toast.error(`评论失败喵～`);
		},
		onSuccess: () => {
			toast.success(`评论成功喵～`);
			queryClient.invalidateQueries({
				queryKey: ["comments", targetType, targetId],
			});
			replycardActions.close();
			form.reset();
		},
	});

	const form = useForm({
		defaultValues: {
			comments: "",
			...(showTypeSelector ? { type: items[0].value } : {}),
		},
		validators: {
			onChange: formSchema,
		},
		onSubmit: async ({ value }) => {
			mutation.mutate({
				data: {
					type: showTypeSelector ? value.type : "comment",
					targetType: targetType,
					targetId: targetId,
					content: value.comments,
					parentId: reId,
					replyToUserId: data?.userId ?? undefined,
				},
			});
		},
	});

	const { data: session, isPending } = useQuery({
		queryKey: ["auth"],
		queryFn: async () => {
			const { data: res, error } = await authClient.getSession();
			elysiaErrorF(error);
			return res;
		},
	});

	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	if (isPending && !reId)
		return <Skeleton className="h-24 w-full rounded-xl" />;

	if (!session && !reId)
		return (
			<div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-card/60 px-6 py-8 text-center ring-1 ring-border/60">
				<Image
					className="rounded-xl"
					src="/neko.webp"
					width={80}
					height={80}
					alt="喵喵喵～这个图片用于提示用户未登陆"
				/>
				<p className="text-sm text-muted-foreground">登录后即可评论</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={() => {
							navigate({
								to: "/auth/login",
								search: {
									return_to: pathname,
								},
							});
						}}
					>
						登录
					</Button>

					<Button
						variant="outline"
						onClick={() => {
							navigate({
								to: "/auth/signup",
								search: {
									return_to: pathname,
								},
							});
						}}
					>
						注册
					</Button>
				</div>
			</div>
		);

	if ((openReId && reId === openReId) || commentscomp)
		return (
			<div>
				<form
					id={formId}
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup className="gap-2">
						<form.Field name="comments">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									// 评论内容
									<Field data-invalid={isInvalid}>
										<Textarea
											className={reId ? "max-h-80 min-h-10" : "max-h-100 min-h-12"}
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={(e) => {
												cursorPosRef.current = {
													start: e.currentTarget.selectionStart ?? 0,
													end: e.currentTarget.selectionEnd ?? 0,
												};
												field.handleBlur();
											}}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											autoComplete="off"
											placeholder={
												commentscomp ? "简单喵两句～" : `回复@${data?.userName}`
											}
										/>
										{isInvalid && (
											<FieldError
												className="text-xs"
												errors={field.state.meta.errors}
											/>
										)}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="type">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<div>
										<Field orientation="horizontal" className="justify-between">
											<div className="flex items-center">
												<KaomojiPicker
													onKaomojiSelect={(emoji) => {
														const { start, end } = cursorPosRef.current;
														const currentValue = form.getFieldValue("comments");
														const newValue =
															currentValue.slice(0, start) +
															` ${emoji} ` +
															currentValue.slice(end);
														form.setFieldValue("comments", newValue);
														// 恢复光标位置到插入内容之后
														requestAnimationFrame(() => {
															const textarea = document.getElementById(
																"comments",
															) as HTMLTextAreaElement | null;
															if (textarea) {
																const newCursorPos = start + emoji.length + 2;
																textarea.setSelectionRange(
																	newCursorPos,
																	newCursorPos,
																);
																textarea.focus();
															}
														});
													}}
													trigger={
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															className="shrink-0 text-muted-foreground"
														>
															<PawPrint />
														</Button>
													}
												/>
											</div>
											{/* 评论类型 */}
											{!reId && showTypeSelector && (
												<Field data-invalid={isInvalid}>
													{/* base-ui ToggleGroup 的 Value 泛型在 type="single" 下类型不稳定，
													    此处显式定型 props，避免框架泛型推断抖动 */}
													<ToggleGroup
														{...(typeToggleProps(
															field,
														) as unknown as ComponentProps<typeof ToggleGroup>)}
													>
														{items.map((item) => (
															<ToggleGroupItem
																key={item.value}
																value={item.value}
																name={field.name}
																aria-label={`${item.label}`}
																className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-xs"
															>
																{item.label}
															</ToggleGroupItem>
														))}
													</ToggleGroup>
												</Field>
											)}
											<Button
												type="submit"
												form={formId}
												disabled={mutation.isPending}
											>
												{mutation.isPending ? (
													<Spinner data-icon="inline-start" />
												) : null}
												发送
											</Button>
										</Field>
									</div>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</div>
		);
};
