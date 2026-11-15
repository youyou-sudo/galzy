import type { ErrorProps } from "@teyik0/furin";
import Errors from "@web/components/error";

/**
 * furin 的错误页适配层。
 *
 * `error` 是 `{ message, digest, status }` 普通对象（见 @teyik0/furin
 * 的 shared/error.ts），不是 Error 实例——旧实现按 `instanceof Error`
 * 取 message，结果所有异常都退化成默认文案，真实原因（例如
 * `[furin] useSearch("…") does not match the current route.`）被丢掉。
 * 这里把原始错误整体交给 `<Errors>`：正文保持友好文案，折叠区保留
 * message / digest / status 供排查（digest 与 API 日志里的哈希对应）。
 */
export default function RootError({ error }: ErrorProps) {
	const source = error as unknown;
	const record =
		typeof source === "object" && source !== null
			? (source as Record<string, unknown>)
			: undefined;
	const status = typeof record?.status === "number" ? record.status : 500;
	const message =
		source instanceof Error
			? source.message
			: typeof record?.message === "string"
				? record.message
				: typeof source === "string"
					? source
					: undefined;
	// Error 实例自身没有可枚举属性（spread 出来是 {}），这类情况只保留 message
	const hasFields = record !== undefined && Object.keys(record).length > 0;
	const detail = hasFields
		? { ...record, ...(message === undefined ? {} : { message }) }
		: (message ?? source);

	return <Errors code={status} detail={detail} />;
}
