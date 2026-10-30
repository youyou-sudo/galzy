/** Wire format shared by the BFF client branch and the Elysia dispatch route. */
export type BffRequestBody = { data?: unknown };

export type BffErrorBody = { status: number; message: string };

export type BffImplLike = {
	input?: unknown;
	handler: (args: { data: any }) => Promise<unknown>;
};

export type BffSchemaOutput<S> = S extends {
	"~standard": { types?: { output: infer O } };
}
	? O
	: any;
