import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@web/components/ui/alert";
import { Button } from "@web/components/ui/button";
import { History } from "lucide-react";

/**
 * 崩溃恢复提示条：展示"上次编辑内容已自动保存"，提供恢复 / 放弃。
 */
export function EditorDraftBanner({
	onRestore,
	onDiscard,
	savedAt,
}: {
	onRestore: () => void;
	onDiscard: () => void;
	savedAt?: number;
}) {
	const timeText = savedAt ? new Date(savedAt).toLocaleString() : undefined;

	return (
		<Alert className="has-[>svg]:grid-cols-[auto_1fr]">
			<History className="size-4 shrink-0 text-primary" data-icon />
			<AlertTitle>检测到上次未提交的草稿</AlertTitle>
			<AlertDescription>
				你上次编辑的内容{timeText ? `（${timeText}）` : ""}
				已自动保存在本机，是否恢复？
			</AlertDescription>
			<AlertAction className="flex items-center gap-1.5">
				<Button size="sm" variant="outline" onClick={onDiscard}>
					放弃
				</Button>
				<Button size="sm" onClick={onRestore}>
					恢复
				</Button>
			</AlertAction>
		</Alert>
	);
}
