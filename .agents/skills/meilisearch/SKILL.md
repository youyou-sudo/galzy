---
name: meilisearch
description: "Meilisearch search engine integration with the JavaScript/TypeScript SDK (v0.44+). Use when working with Meilisearch indexes, search queries, filters, facets, sorting, multi-search, tenant isolation, document sync, or search settings configuration. Triggers on: meilisearch client setup, index creation, addDocuments, search with filters, facetDistribution, tenant tokens, multi-search, ranking rules, filterable/sortable/searchable attributes. Use this skill any time the user mentions Meilisearch, search indexing, full-text search in their app, or asks about tenant-scoped search — even for simple tasks like 'add search to this page', because the skill contains critical multi-tenancy and filter syntax patterns that prevent data leaks."
---

# Meilisearch JS/TS SDK

This skill covers the `meilisearch` npm package for building search features with the Meilisearch engine. It focuses on TypeScript patterns, multi-tenant safety, and the gotchas that cause real production issues.

## Client Setup

```typescript
import { MeiliSearch } from "meilisearch";

const client = new MeiliSearch({
  host: "http://localhost:7700",
  apiKey: "your-api-key",
});
```

- The `host` must include the protocol (`http://` or `https://`).
- In production, never use the master key as `apiKey` — create scoped API keys (search-only, admin) via the Meilisearch API or dashboard.

## Core Concepts

### Indexes

An index holds documents. Think of it like a database table optimized for search.

```typescript
// Create an index (async — returns a task)
const task = await client.createIndex("inventory", { primaryKey: "id" });
await client.waitForTask(task.taskUid);

// Get a reference (does NOT create it)
const index = client.index("inventory");
```

**Gotcha:** `client.index("foo")` is synchronous and returns a reference even if the index doesn't exist. It will fail only when you try to use it. Use `client.createIndex()` to ensure it exists.

### Tasks Are Async

Almost every write operation (add documents, update settings, delete) returns an `EnqueuedTask` with a `taskUid`. The operation is NOT complete when the function returns — it's enqueued.

```typescript
const { taskUid } = await index.addDocuments(docs);
// Document is NOT searchable yet!

await client.waitForTask(taskUid);
// NOW it's searchable
```

For settings changes (filterable attributes, ranking rules), always `waitForTask` before searching — queries against partially-configured indexes produce wrong results.

## Documents

### Adding / Updating

```typescript
// Add documents (creates them, or replaces if primary key matches)
await index.addDocuments([
  { id: "1", name: "10x10 Booth", tenant_id: "tenant-abc", status: "available" },
  { id: "2", name: "Pop-up Banner", tenant_id: "tenant-abc", status: "in_use" },
]);

// Partial update (only updates provided fields, keeps the rest)
await index.updateDocuments([
  { id: "1", status: "reserved" },
]);
```

**`addDocuments` vs `updateDocuments`:** `addDocuments` replaces the entire document if the primary key exists. `updateDocuments` merges — it only overwrites fields you provide. Use `updateDocuments` for partial updates.

### Deleting

```typescript
await index.deleteDocument("1");            // Single document
await index.deleteDocuments(["1", "2"]);    // Batch by IDs
await index.deleteDocuments({ filter: 'status = "archived"' }); // By filter
await index.deleteAllDocuments();           // Nuclear option
```

### Fetching (Non-Search)

```typescript
const doc = await index.getDocument("1");
const { results, total } = await index.getDocuments({ limit: 20, offset: 0 });
```

## Search

### Basic Search

```typescript
const results = await index.search("booth", {
  limit: 20,
  offset: 0,
  attributesToRetrieve: ["id", "name", "status"],
  attributesToHighlight: ["name"],
});

// results.hits — array of matching documents
// results.estimatedTotalHits — approximate total count
// results.processingTimeMs — how long Meilisearch took
```

### Filters

Filters let you narrow results by exact values, ranges, or boolean logic. Attributes must be declared as `filterableAttributes` before they can be used in filters.

```typescript
// Configure filterable attributes (do this at index setup, not per-query)
await index.updateFilterableAttributes(["tenant_id", "status", "category", "price"]);
```

**Filter syntax:**

```typescript
// Equality
filter: 'status = "available"'

// Inequality
filter: 'price > 100'
filter: 'price >= 50 AND price <= 200'

// IN operator (any of these values)
filter: 'status IN ["available", "reserved"]'

// AND / OR / NOT
filter: 'status = "available" AND category = "booth"'
filter: 'status = "available" OR status = "reserved"'
filter: 'NOT status = "archived"'

// Parentheses for grouping
filter: '(status = "available" OR status = "reserved") AND category = "booth"'

// Array of strings = implicit AND
filter: ['tenant_id = "abc"', 'status = "available"']
```

**Gotcha:** String values in filters MUST be wrapped in double quotes. Numeric values must NOT be quoted. `status = available` is invalid — it must be `status = "available"`. But `price > 100` is correct (no quotes around 100).

### Sorting

```typescript
// Configure sortable attributes first
await index.updateSortableAttributes(["name", "created_at", "price"]);

// Then sort in queries
const results = await index.search("booth", {
  sort: ["price:asc"],           // Single sort
  sort: ["price:asc", "name:asc"], // Multi-sort (tiebreaker)
});
```

### Facets

Facets return value distributions for filterable attributes — used for building filter UIs (sidebar counts).

```typescript
const results = await index.search("", {
  facets: ["category", "status"],
  filter: 'tenant_id = "abc"',
});

// results.facetDistribution = {
//   category: { "booth": 12, "banner": 8, "furniture": 3 },
//   status: { "available": 15, "in_use": 6, "reserved": 2 }
// }
```

Only attributes listed in `filterableAttributes` can be used as facets.

### Pagination

Two modes: **offset/limit** (default) and **finite pagination** (page/hitsPerPage).

```typescript
// Offset-based (for infinite scroll)
await index.search("booth", { offset: 20, limit: 10 });

// Page-based (for numbered pages)
await index.search("booth", { page: 3, hitsPerPage: 10 });
// Returns: totalPages, totalHits, page
```

**Gotcha:** You cannot mix the two modes in the same query. If you pass `page`, don't also pass `offset`.

## Multi-Tenant Search (Critical)

In multi-tenant apps, every search MUST be scoped to a tenant. There are two approaches, and they can be layered for defense-in-depth.

### Approach 1: Application-Level Filter (Simplest)

Always append `tenant_id` to the filter. This is what you control in your application code.

```typescript
async function searchWithTenant<T extends Record<string, unknown>>(
  indexName: string,
  query: string,
  tenantId: string,
  options?: Omit<SearchParams, "filter">,
) {
  const index = client.index<T>(indexName);
  return index.search(query, {
    ...options,
    filter: `tenant_id = "${tenantId}"`,
  });
}
```

**Gotcha:** If you accept additional user-provided filters, combine them carefully:

```typescript
// WRONG — overwrites tenant filter
const results = await index.search(query, { filter: userFilter });

// RIGHT — combine with AND
const filter = userFilter
  ? `tenant_id = "${tenantId}" AND (${userFilter})`
  : `tenant_id = "${tenantId}"`;
```

### Approach 2: Tenant Tokens (Defense-in-Depth)

Meilisearch tenant tokens embed filter rules into the JWT itself, so even if the application filter is bypassed, the engine enforces tenant isolation.

```typescript
const tenantToken = client.generateTenantToken(
  searchApiKeyUid,  // UID of the search API key (not the key itself)
  {
    "inventory": { filter: `tenant_id = "${tenantId}"` },
    "*": { filter: `tenant_id = "${tenantId}"` },  // Apply to all indexes
  },
  {
    apiKey: searchApiKey,
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
  },
);
```

This token can be sent to the frontend for client-side search without exposing the real API key.

### Document Sync Safety

When syncing documents to search indexes, always validate `tenant_id` presence:

```typescript
function syncToSearch<T extends { tenant_id: string }>(
  indexName: string,
  documents: T[],
) {
  for (const doc of documents) {
    if (!doc.tenant_id) {
      throw new Error(`Document missing tenant_id: ${JSON.stringify(doc)}`);
    }
  }
  return client.index(indexName).addDocuments(documents);
}
```

## Multi-Search

Search across multiple indexes in a single HTTP request. Two modes: independent results or federated (merged into one list).

```typescript
// Independent results per index
const results = await client.multiSearch({
  queries: [
    { indexUid: "inventory", q: "booth", filter: `tenant_id = "${tenantId}"` },
    { indexUid: "events", q: "booth", filter: `tenant_id = "${tenantId}"` },
  ],
});
// results.results[0] — inventory hits
// results.results[1] — events hits

// Federated (merged into one ranked list)
const federated = await client.multiSearch({
  federation: {},
  queries: [
    { indexUid: "inventory", q: "booth", filter: `tenant_id = "${tenantId}"` },
    { indexUid: "events", q: "booth", filter: `tenant_id = "${tenantId}"`,
      federationOptions: { weight: 1.2 } },  // Boost event results
  ],
});
// federated.hits — single merged list with _federation metadata
```

**Gotcha:** In federated mode, each hit includes `_federation.indexUid` so you know which index it came from. Apply tenant filters to every query — federation does NOT inherit filters across queries.

## Index Settings

Configure these at index creation/setup time, not per-query:

```typescript
const index = client.index("inventory");

// What fields are full-text searchable (order = priority)
await index.updateSearchableAttributes(["name", "description", "tags"]);

// What fields can be used in filters and facets
await index.updateFilterableAttributes(["tenant_id", "category", "status", "condition"]);

// What fields can be sorted on
await index.updateSortableAttributes(["name", "created_at", "updated_at"]);

// What fields are returned in results (default: all)
await index.updateDisplayedAttributes(["id", "name", "status", "category"]);

// Custom ranking rules
await index.updateRankingRules([
  "words",      // Number of matching terms
  "typo",       // Fewer typos rank higher
  "proximity",  // Closer matching terms rank higher
  "attribute",  // Matches in higher-priority searchable attributes rank higher
  "sort",       // User-requested sort
  "exactness",  // Exact matches rank higher
]);

// Distinct attribute (deduplicate by field — e.g., one result per product)
await index.updateDistinctAttribute("product_id");

// Synonyms
await index.updateSynonyms({
  booth: ["stand", "exhibit"],
  banner: ["sign", "display"],
});
```

**Gotcha:** Settings changes are async. Always `waitForTask` after updating settings before running searches — otherwise you search against stale config.

## API Keys

```typescript
// Create a search-only key
const key = await client.createKey({
  description: "Search key for client app",
  actions: ["search"],
  indexes: ["inventory", "events"],
  expiresAt: new Date("2027-01-01"),
});
// key.key — the API key string
// key.uid — needed for tenant token generation

// List all keys
const { results } = await client.getKeys();

// Delete a key
await client.deleteKey(key.uid);
```

**Key hierarchy:** Master key > Admin keys (all actions) > Search keys (search only). Never expose the master key to clients.

## Common Pitfalls

1. **Forgetting `waitForTask`** — The #1 source of "my documents aren't showing up" bugs. Write operations are enqueued, not immediate.

2. **Filter on non-filterable attribute** — Meilisearch silently ignores the filter rather than erroring. Your search returns unfiltered results and you might not notice. Always verify `filterableAttributes` are set.

3. **Missing tenant_id filter** — In a multi-tenant app, a search without tenant scoping leaks data across tenants. Centralize tenant filtering in a wrapper function, never rely on callers to remember.

4. **String values without quotes in filters** — `status = available` silently fails. Must be `status = "available"`.

5. **Mixing pagination modes** — Using both `offset` and `page` in the same query causes unpredictable behavior.

6. **Large batch imports without chunking** — For >10K documents, chunk into batches of 5K-10K to avoid timeout issues. Meilisearch processes them sequentially anyway.

7. **Updating settings in production without waitForTask** — Settings changes temporarily make the index unavailable for that feature. Always wait for completion.

## Reference Docs

For deeper topics, read these files in `references/`:

- **`references/advanced-search.md`** — Highlighting, cropping, matching strategy, attributes to search on, show ranking score
- **`references/error-handling.md`** — Task error codes, MeiliSearchApiError handling, retry patterns
