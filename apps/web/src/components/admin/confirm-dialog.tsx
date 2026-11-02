import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@web/components/ui/alert-dialog";
import { Button } from "@web/components/ui/button";
import { Spinner } from "@web/components/ui/spinner";
import { cn } from "@web/lib/utils";
import type { ReactNode } from "react";

/**
 * 统一确认弹窗。
 *
 * 相比各页手写 Dialog：底部按钮固定「取消 / 确认」顺序，确认按钮
 * 有 pending 态（提交中禁用并转圈），危险操作用 destructive 语义色，
 * 且内容区始终 text-start（长文本不会被居中成标题）。
 *
 * @example
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="删除评论"
 *   desc="删除后用户将无法看到该评论。"
 *   confirmText="确认删除"
 *   destructive
 *   isLoading={mutation.isPending}
 *   onConfirm={() => mutation.mutate(id)}
 * />
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	desc,
	children,
	confirmText = "确认",
	cancelText = "取消",
	destructive = false,
	isLoading = false,
	disabled = false,
	onConfirm,
	className,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	desc?: ReactNode;
	/** 弹窗正文（如待删内容的引用块） */
	children?: ReactNode;
	confirmText?: ReactNode;
	cancelText?: ReactNode;
	destructive?: boolean;
	isLoading?: boolean;
	disabled?: boolean;
	onConfirm: () => void;
	className?: string;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className={cn("max-w-md", className)}>
				<AlertDialogHeader className="text-start">
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{desc != null && (
						<AlertDialogDescription render={<div />} className="text-start">
							{desc}
						</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				{children}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading}>
						{cancelText}
					</AlertDialogCancel>
					<Button
						variant={destructive ? "destructive" : "default"}
						disabled={disabled || isLoading}
						onClick={onConfirm}
					>
						{isLoading && <Spinner className="size-3.5" />}
						{confirmText}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
