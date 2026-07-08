# Advanced Search Features

## Highlighting and Cropping

Highlight matching terms in results and crop long text fields to show relevant snippets.

```typescript
const results = await index.search("trade show", {
  attributesToHighlight: ["name", "description"],
  highlightPreTag: "<mark>",     // Default: <em>
  highlightPostTag: "</mark>",   // Default: </em>
  attributesToCrop: ["description"],
  cropLength: 50,                // Characters around the match
  cropMarker: "...",             // Default: ...
});

// results.hits[0]._formatted.description
// → "...annual <mark>trade show</mark> with 200 exhibitors..."
```

## Matching Strategy

Controls how Meilisearch handles multi-word queries.

```typescript
// "last" (default) — matches documents with ALL words first,
// then progressively drops words from the end
await index.search("portable trade show booth", {
  matchingStrategy: "last",
});

// "all" — only returns documents matching ALL query words
await index.search("portable trade show booth", {
  matchingStrategy: "all",
});

// "frequency" — removes the most common word first
await index.search("portable trade show booth", {
  matchingStrategy: "frequency",
});
```

Use `"all"` when precision matters (exact search). Use `"last"` (default) for broader recall.

## Restrict Searchable Attributes Per Query

Override which fields are searched without changing index settings:

```typescript
// Only search the name field, ignoring description/tags
const results = await index.search("booth", {
  attributesToSearchOn: ["name"],
});
```

This is per-query — it doesn't change the index configuration.

## Show Ranking Score

Debug relevance by requesting the ranking score for each hit:

```typescript
const results = await index.search("booth", {
  showRankingScore: true,
  showRankingScoreDetails: true,
});

// results.hits[0]._rankingScore → 0.89
// results.hits[0]._rankingScoreDetails → {
//   words: { order: 0, matchingWords: 1, maxMatchingWords: 1, score: 1 },
//   typo: { order: 1, typoCount: 0, maxTypoCount: 1, score: 1 },
//   ...
// }
```

Useful for understanding why certain results rank higher/lower than expected.

## Geosearch

Search by geographic location. Documents must have `_geo` field with `lat` and `lng`.

```typescript
// Add documents with geo data
await index.addDocuments([
  { id: "1", name: "McCormick Place", _geo: { lat: 41.8507, lng: -87.6153 } },
]);

// Configure _geo as filterable
await index.updateFilterableAttributes(["_geo", "tenant_id"]);
await index.updateSortableAttributes(["_geo"]);

// Search within radius (meters)
const results = await index.search("", {
  filter: "_geoRadius(41.8507, -87.6153, 50000)",  // 50km radius
  sort: ["_geoPoint(41.8507, -87.6153):asc"],       // Sort by distance
});
// Each hit gets _geoDistance (meters from the point)
```

## Distinct Attribute

Return only one result per unique value of an attribute. Useful for deduplication.

```typescript
await index.updateDistinctAttribute("product_group_id");

// Now search returns at most 1 hit per product_group_id
```

Only one distinct attribute can be set per index.
