import { t } from "elysia";
import {
	TASK_ORDER_KEYS,
	TASK_PAGE_SIZES,
	TASK_RANGE_KEYS,
	TASK_SORT_FIELDS,
	TASK_STATUS_KEYS,
} from "./params";

function literalUnion(values: readonly string[]) {
	return t.Union(values.map((value) => t.Literal(value)) as never);
}

/**
 * TypeBox twin of taskSearchSchema, used as the route query schema.
 *
 * Furin only coerces repeated keys (`?status=a&status=b`) into arrays and
 * string booleans into booleans for TypeBox schemas; a zod schema sees the last
 * value and a string "true". The zod schema stays the source of truth for the
 * UI-side normalisation helpers.
 */
export const taskSearchQuery = t.Object({
	q: t.Optional(t.String({ default: "" })),
	status: t.Optional(t.Array(literalUnion(TASK_STATUS_KEYS))),
	queue: t.Optional(t.Array(t.String())),
	type: t.Optional(t.Array(t.String())),
	range: t.Optional(literalUnion(TASK_RANGE_KEYS)),
	overdue: t.Optional(t.Boolean({ default: false })),
	retryable: t.Optional(t.Boolean({ default: false })),
	sortBy: t.Optional(literalUnion(TASK_SORT_FIELDS)),
	order: t.Optional(literalUnion(TASK_ORDER_KEYS)),
	page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
	pageSize: t.Optional(literalUnion(TASK_PAGE_SIZES)),
	job: t.Optional(t.String()),
});
