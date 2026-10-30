import type { ErrorProps } from "@teyik0/furin";
import Errors from "@web/components/error";

export default function RootError({ error }: ErrorProps) {
	const status =
		typeof error === "object" && error && "status" in error && typeof (error as { status: unknown }).status === "number"
			? (error as { status: number }).status
			: 500;
	const message =
		error instanceof Error ? error.message : typeof error === "string" ? error : "页面加载出错喵～";
	return <Errors code={status} errormessage={message} />;
}
