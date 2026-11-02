import type { BffImplLike, BffSchemaOutput } from "./protocol";

/**
 * Declare a BFF handler. Replaces TanStack Start's
 * createServerFn().validator(schema).handler(fn) chain.
 *
 * The returned value stays callable - call sites keep writing
 * getThing({ data }) - and carries the input schema plus the raw handler so
 * the server registry can validate and dispatch it.
 */
export function defineBff<V, R>(
	input: (value: any) => V,
	handler: (args: { data: V }) => Promise<R>,
): ((args: { data: V }) => Promise<R>) & {
	input: (value: any) => V;
	handler: (args: { data: V }) => Promise<R>;
};
export function defineBff<S extends { "~standard": any }, R>(
	input: S,
	handler: (args: { data: BffSchemaOutput<S> }) => Promise<R>,
): ((args: { data: BffSchemaOutput<S> }) => Promise<R>) & {
	input: S;
	handler: (args: { data: BffSchemaOutput<S> }) => Promise<R>;
};
export function defineBff(input: any, handler: (args: any) => Promise<any>) {
	const fn = ((args: any) => handler(args)) as {
		(args: any): Promise<any>;
		input: any;
		handler: (args: any) => Promise<any>;
	};
	fn.input = input;
	fn.handler = handler;
	return fn;
}

/** No-input variant for handlers that do not validate a payload. */
export function defineBffNoInput<R>(
	handler: (args: { data: undefined }) => Promise<R>,
) {
	const fn = (() => handler({ data: undefined })) as unknown as ((
		args?: { data?: undefined },
	) => Promise<R>) & { input: undefined; handler: (args: { data: undefined }) => Promise<R> };
	fn.input = undefined;
	fn.handler = handler;
	return fn;
}

export type BffImpl = BffImplLike;
