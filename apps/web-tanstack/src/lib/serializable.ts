/**
 * 剔除 unknown/any 字段（递归），满足 TanStack ServerFn 的可序列化类型检查。
 *
 * unknown/any 字段在运行时是合法 JSON（实际值可正常序列化），仅类型检查
 * 拒绝它们。Eden/Elysia 推断的响应类型里 sql 模板列（jsonb 等）常为
 * unknown，server fn 直接透传会触发 ValidateSerializableMapped 失败，
 * 使下游组件拿到退化的 `{}` 类型。
 *
 * 联合类型会分布展开（如 `X | null` → `StripUnknown<X> | null`），
 * 因此可直接作用于含 null/undefined 的联合，无需先 NonNullable。
 */
export type StripUnknown<T> = T extends unknown
	? T extends
			| string
			| number
			| boolean
			| bigint
			| symbol
			| null
			| undefined
			| Date
			| ((...args: never[]) => unknown)
		? T
		: T extends readonly (infer E)[]
			? StripUnknown<E>[]
			: {
					[K in keyof T as T[K] extends unknown
						? unknown extends T[K]
							? never
							: K
						: K]: StripUnknown<T[K]>
				}
	: never
