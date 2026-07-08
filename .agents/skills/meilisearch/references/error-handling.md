# Error Handling and Reliability

## MeiliSearchApiError

The SDK throws `MeiliSearchApiError` for API-level errors. It contains structured error information.

```typescript
import { MeiliSearchApiError } from "meilisearch";

try {
  await index.search("query", { filter: 'bad_field = "value"' });
} catch (error) {
  if (error instanceof MeiliSearchApiError) {
    console.error(error.code);    // e.g., "invalid_search_filter"
    console.error(error.message); // Human-readable description
    console.error(error.type);    // "invalid_request" | "internal" | "auth"
    console.error(error.link);    // Link to docs for this error
  }
}
```

## Common Error Codes

| Code | Meaning | Fix |
|---|---|---|
| `index_not_found` | Index doesn't exist | Create it with `client.createIndex()` first |
| `invalid_search_filter` | Filter syntax error or attribute not filterable | Check filter syntax and `filterableAttributes` |
| `invalid_search_sort` | Sort attribute not declared sortable | Add to `sortableAttributes` |
| `invalid_document_id` | Primary key value is invalid | Must be string or integer, no special chars |
| `missing_document_id` | Document missing primary key field | Ensure every document has the primary key |
| `invalid_api_key` | Authentication failed | Check API key permissions and expiration |
| `immutable_api_key_uid` | Tried to change a key's UID | UIDs are assigned at creation, can't be changed |
| `document_fields_limit_reached` | Too many fields in a document | Meilisearch has a 65,535 field limit per index |

## Task Errors

Write operations return tasks. Tasks can fail asynchronously.

```typescript
const { taskUid } = await index.addDocuments(docs);
const task = await client.waitForTask(taskUid);

if (task.status === "failed") {
  console.error(task.error);
  // { message: "...", code: "...", type: "...", link: "..." }
}
```

Always check task status after `waitForTask` — it resolves when the task finishes, whether it succeeded or failed.

## Retry Patterns

Meilisearch write operations are idempotent (same document with same ID = safe to retry), so retries are safe for network errors.

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Only retry on network/timeout errors, not validation errors
      if (error instanceof MeiliSearchApiError) {
        if (error.type === "invalid_request") throw error; // Don't retry bad input
      }

      await new Promise((r) => setTimeout(r, delayMs * 2 ** attempt));
    }
  }
  throw new Error("unreachable");
}
```

## Health Check

```typescript
try {
  const health = await client.health();
  // { status: "available" }
} catch {
  // Meilisearch is down or unreachable
}
```

Use this in readiness probes, not in hot paths.

## Connection Errors

The SDK throws generic `Error` (not `MeiliSearchApiError`) for connection failures (ECONNREFUSED, timeout). Handle both:

```typescript
try {
  await index.search("query");
} catch (error) {
  if (error instanceof MeiliSearchApiError) {
    // API-level error (bad filter, auth failure, etc.)
  } else {
    // Connection-level error (Meilisearch unreachable)
  }
}
```
