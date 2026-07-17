---
name: vndb-api
description: VNDB API v2 (Kana) integration for querying visual novel database entries, characters, releases, producers, staff, tags, traits, quotes, and managing user lists.
---

# VNDB API v2 (Kana) Skill

**API endpoint**: `https://api.vndb.org/kana`
**Sandbox**: `https://beta.vndb.org/api/kana`

## When to Use This Skill

Trigger this skill when the user asks to:
- Query visual novels, characters, releases, producers, staff, tags, traits, or quotes from VNDB
- Search the VNDB database
- Manage VNDB user lists (ulist/rlist)
- Integrate VNDB data into the app
- Work with vndbid identifiers
- Handle VNDB API authentication

## Usage Terms

- Free for non-commercial use
- Rate limit: 200 requests per 5 minutes, 1 second execution time per minute
- Requests >3 seconds are aborted
- Subject to [VNDB Data License](https://vndb.org/d17#4)

## Common Data Types

**vndbid**: Identifier with prefix, e.g. `"v17"` (VN), `"sf190"` (screenshot). Returned as JSON string; filters accept bare integers if prefix is unambiguous.

**Release date**: `"YYYY-MM-DD"`, `"YYYY-MM"`, `"YYYY"`, or `"TBA"`. Partial dates sort *after* complete dates for the same year/month.

## User Authentication

### Cookie-based
For scripts running on `vndb.org`: set `XMLHttpRequest.withCredentials` or Fetch `credentials: 'include'`.

### Token-based
Tokens from `https://vndb.org/u/tokens`. Format: `xxxx-xxxxx-xxxxx-xxxx-xxxxx-xxxxx-xxxx` (z-base-32, dashes optional).

Include via header:
```
Authorization: Token <token>
```

### Permissions
| Permission | Description |
|------------|-------------|
| `listread` | Read access to private labels and VN list entries |
| `listwrite` | Write access to the user's VN list |

## Simple Requests

### GET /schema
Returns JSON object with enum values, available fields per type, external links. Safe to use for code generation.
```
curl https://api.vndb.org/kana/schema
```

### GET /stats
Overall database statistics.
```
curl https://api.vndb.org/kana/stats
```

### GET /user
Lookup users by id or username. Query params: `q` (repeatable), `fields`.
```typescript
GET /kana/user?q=Yorhel&q=u3
```
Fields: `id` (always included), `username`, `lengthvotes`, `lengthvotes_sum`.

### GET /authinfo
Validates token and returns user info.
```
curl https://api.vndb.org/kana/authinfo -H 'Authorization: Token <token>'
```

## Database Querying (POST)

All database queries use a common JSON POST format.

### Query Format
```json
{
  "filters": [],
  "fields": "",
  "sort": "id",
  "reverse": false,
  "results": 10,
  "page": 1,
  "user": null,
  "count": false,
  "compact_filters": false,
  "normalized_filters": false
}
```

**fields**: Comma-separated. Dot notation for nested: `"image.url"`. Bracket syntax: `"image{id,url,dims}"`. No wildcards. `id` is always included.

**results**: Max 100. Set to `0` to only get `count`/`compact_filters`/`normalized_filters` without results.

### Response Format
```json
{
  "results": [],
  "more": false,
  "count": 1,
  "compact_filters": "",
  "normalized_filters": []
}
```

- `more`: When `true`, increment `page` for more results (cheaper than `count`).
- `count`: Only present with `"count":true`.

### Filters

Simple predicate: `[field, operator, value]`, e.g. `["id", "=", "v17"]`.

Operators: `=`, `!=`, `>=`, `>`, `<=`, `<`.

Combined with and/or:
```json
["and",
  ["or", ["lang", "=", "en"], ["lang", "=", "ja"]],
  ["released", ">=", "2020-01-01"]
]
```

Compact string format is also accepted (from website URLs). Use `"normalized_filters": true` to convert.

### Filter Flags

| Flag | Description |
|------|-------------|
| `o` | Supports ordering operators (`>`, `<`, etc.) |
| `n` | Accepts `null` |
| `m` | Single entry can match multiple values |
| `i` | Negation is not always equivalent to set inversion |

## POST /vn — Visual Novels

Sort options: `id`, `title`, `released`, `rating`, `votecount`, `searchrank`

### VN Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `search` | m | String search (titles, aliases, release titles) |
| `lang` | m | Language availability |
| `olang` | | Original language |
| `platform` | m | Platform availability |
| `length` | o | 1 (very short) to 5 (very long) |
| `released` | o,n | Release date |
| `rating` | o,i | Bayesian rating (10-100) |
| `votecount` | o | Number of votes |
| `has_description` | | Value: `1` (negatable) |
| `has_anime` | | Value: `1` |
| `has_screenshot` | | Value: `1` |
| `has_review` | | Value: `1` |
| `devstatus` | | 0=Finished, 1=In dev, 2=Cancelled |
| `tag` | m | Tags (matches parent tags). Value: `id` or `[id, max_spoiler, min_level]` |
| `dtag` | m | Direct tags only (no parents) |
| `anime_id` | | AniDB anime ID |
| `label` | m | `[user_id, label_id]` or just `label_id` when authenticated |
| `release` | m | Match VNs with releases matching nested release filters |
| `character` | m | Match VNs with characters matching nested character filters |
| `staff` | m | Match VNs with staff matching nested staff filters |
| `developer` | m | Match VNs by developer (nested producer filters) |

### Key VN Fields

```typescript
id, title, alttitle, olang, released, devstatus,
languages[], platforms[], image{id, url, dims, sexual, violence, thumbnail, thumbnail_dims},
length, length_minutes, length_votes,
description, average, rating, votecount,
aliases[],
titles[]{ lang, title, latin, official, main },
screenshots[]{ image.*, release.* },
relations[]{ relation, relation_official, ... },
tags[]{ rating, spoiler, lie, ... },
developers[]{ ... },
editions[]{ eid, lang, name, official },
staff[]{ eid, role, note, ... },
va[]{ note, staff.*, character.* },
extlinks[]
```

### Common VN Query Examples

Fetch by ID:
```bash
curl https://api.vndb.org/kana/vn -H 'Content-Type: application/json' \
  -d '{"filters":["id","=","v17"],"fields":"title,image.url"}'
```

Search VNs:
```bash
curl https://api.vndb.org/kana/vn -H 'Content-Type: application/json' \
  -d '{"filters":["search","=","Steins;Gate"],"fields":"title,rating,released"}'
```

Filter with tag and rating:
```bash
curl https://api.vndb.org/kana/vn -H 'Content-Type: application/json' \
  -d '{"filters":["and",["tag","=",["g505",2,1.2]],["rating",">=",70]],"fields":"title,rating","sort":"rating","reverse":true}'
```

## POST /release

Sort options: `id`, `title`, `released`, `searchrank`

### Release Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `search` | m | String search |
| `lang` | m | Available languages |
| `platform` | m | Available platforms |
| `released` | o | Release date |
| `resolution` | o,i | `[width, height]` comparison |
| `resolution_aspect` | o,i | Resolution + aspect ratio match |
| `minage` | o,n,i | Age rating (0-18) |
| `medium` | m,n | String |
| `voiced` | n | 1=not voiced, 2=ero only, 3=partial, 4=full |
| `engine` | n | String |
| `rtype` | m | `"trial"`, `"partial"`, or `"complete"` |
| `extlink` | m | Site name, `[site, id]`, or URL |
| `drm` | m | DRM implementation |
| `image` | m,n | Image type |
| `patch` | | Value: `1` |
| `freeware` | | Value: `1` |
| `uncensored` | i | Value: `1` |
| `official` | | Value: `1` |
| `has_ero` | | Value: `1` |
| `vn` | m | Nested VN filters |
| `producer` | m | Nested producer filters |

### Key Release Fields

```typescript
id, title, alttitle, released, minage,
patch, freeware, uncensored, official, has_ero,
resolution, engine, voiced,
notes, gtin, catalog,
languages[]{ lang, title, latin, mtl, main },
platforms[],
media[]{ medium, qty },
vns[]{ rtype, ... },
producers[]{ developer, publisher, ... },
images[]{ type, vn, languages, photo, ... },
extlinks[]{ url, label, name, id }
```

## POST /producer

Sort options: `id`, `name`, `searchrank`

### Producer Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `search` | m | String search |
| `lang` | | Primary language |
| `type` | | `"co"` (company), `"in"` (individual), `"ng"` (amateur) |
| `extlink` | m | External link match |

### Producer Fields
```typescript
id, name, original, aliases[], lang, type, description, extlinks[]
```

## POST /character

Sort options: `id`, `name`, `searchrank`

### Character Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `search` | m | String search |
| `role` | m | `"main"`, `"primary"`, `"side"`, `"appears"` |
| `blood_type` | | `"a"`, `"b"`, `"ab"`, `"o"` |
| `sex` | | String |
| `sex_spoil` | | String |
| `gender` | | String |
| `gender_spoil` | | String |
| `height` | o,n,i | cm |
| `weight` | o,n,i | kg |
| `bust` | o,n,i | cm |
| `waist` | o,n,i | cm |
| `hips` | o,n,i | cm |
| `cup` | o,n,i | Cup size string |
| `age` | o,n,i | Years |
| `trait` | m | Trait ID or `[id, max_spoiler]` |
| `dtrait` | m | Direct traits only |
| `birthday` | n | `[month, day]`, day can be `0` |
| `seiyuu` | m | Nested staff filters for voice actors |
| `vn` | m | Nested VN filters |

### Character Fields
```typescript
id, name, original, aliases[], description,
image{ id, url, dims, sexual, violence, votecount },
blood_type, height, weight, bust, waist, hips, cup, age,
birthday, // [month, day] or null
sex, // [apparent, real] or null: null|"m"|"f"|"b"|"n"
gender, // [non-spoiler, spoiler] or null: null|"m"|"f"|"o"|"a"
vns[]{ spoiler, role, release.*, ... },
traits[]{ spoiler, lie, ... }
```

## POST /staff

Queries staff *names* (not entries). Use `ismain` filter to deduplicate.

Sort options: `id`, `name`, `searchrank`

### Staff Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `aid` | | Alias ID |
| `search` | m | String search |
| `lang` | | Language |
| `gender` | | `"m"` or `"f"` |
| `role` | m | `"seiyuu"` or staff role enum |
| `extlink` | m | External link match |
| `ismain` | | Value: `1` (deduplicate to one result per staff entry) |

### Staff Fields
```typescript
id, aid, ismain, name, original, lang, gender, description,
extlinks[],
aliases[]{ aid, name, latin, ismain }
```

### Staff Example
```bash
curl https://api.vndb.org/kana/staff -H 'Content-Type: application/json' \
  -d '{"filters":["and",["ismain","=",1],["id","=","s81"]],"fields":"lang,aliases{name,latin,ismain},description,extlinks{url,label}"}'
```

## POST /tag

Sort options: `id`, `name`, `vn_count`, `searchrank`

### Tag Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `search` | m | String search |
| `category` | | `"cont"`, `"ero"`, `"tech"` |

### Tag Fields
```typescript
id, name, aliases[], description, category, searchable, applicable, vn_count
```

## POST /trait

Sort options: `id`, `name`, `char_count`, `searchrank`

### Trait Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `search` | m | String search |

### Trait Fields
```typescript
id, name, aliases[], description, searchable, applicable, sexual,
group_id, group_name, char_count
```

## POST /quote

Sort options: `id`, `score`

### Quote Filters

| Name | Flags | Description |
|------|-------|-------------|
| `id` | o | vndbid |
| `vn` | | Nested VN filters |
| `character` | | Nested character filters |
| `random` | | Value: `1` — random quote with positive score |

### Quote Fields
```typescript
id, quote, score, vn.*, character.*
```

### Random Quote Example
```bash
curl https://api.vndb.org/kana/quote -H 'Content-Type: application/json' \
  -d '{"fields":"vn{id,title},character{id,name},quote","filters":["random","=",1]}'
```

## List Management

### POST /ulist — Fetch user list

Requires `"user"` parameter. All VN filters work here.

Sort options: `id`, `title`, `released`, `rating`, `votecount`, `voted`, `vote`, `added`, `lastmod`, `started`, `finished`, `searchrank`

```bash
curl https://api.vndb.org/kana/ulist -H 'Content-Type: application/json' \
  -d '{"user":"u2","fields":"id,vote,vn.title","filters":["label","=",7],"sort":"vote","reverse":true,"results":10}'
```

#### UList Fields
```typescript
id, added, voted, lastmod, vote, started, finished, notes,
labels[]{ id, label },
vn.*,
releases[]{ list_status, ... }
```

### GET /ulist_labels — Fetch user labels

Parameters: `user` (string), `fields` (currently only `count`).

```bash
curl 'https://api.vndb.org/kana/ulist_labels?user=u1'
```

### PATCH /ulist/<id> — Add/update VN in user list

Requires `listwrite` permission. Body fields:

| Field | Type | Description |
|-------|------|-------------|
| `vote` | int | 10-100 |
| `notes` | string | |
| `started` | date | |
| `finished` | date | |
| `labels` | int[] | Overwrite all labels |
| `labels_set` | int[] | Add labels |
| `labels_unset` | int[] | Remove labels |

Use `null` to unset a field (except labels). Labels 0 ("No label") and 7 ("Voted") cannot be manually set.

```bash
curl -XPATCH https://api.vndb.org/kana/ulist/v17 \
  -H 'Authorization: Token <token>' \
  -H 'Content-Type: application/json' \
  -d '{"labels_unset":[1],"labels_set":[2],"vote":60}'
```

### PATCH /rlist/<id> — Add/update release in user list

Requires `listwrite` permission. Body: `{"status": 0|1|2|3|4}` (0=Unknown, 1=Pending, 2=Obtained, 3=On loan, 4=Deleted). Defaults to 0.

```bash
curl -XPATCH https://api.vndb.org/kana/rlist/r12 \
  -H 'Authorization: Token <token>' \
  -H 'Content-Type: application/json' \
  -d '{"status":2}'
```

### DELETE /ulist/<id> — Remove VN from user list

Removes associated releases too. Returns success even if not on list.

```bash
curl -XDELETE https://api.vndb.org/kana/ulist/v17 -H 'Authorization: Token <token>'
```

### DELETE /rlist/<id> — Remove release from user list

Does NOT remove associated VNs from the VN list.

```bash
curl -XDELETE https://api.vndb.org/kana/rlist/r12 -H 'Authorization: Token <token>'
```

## HTTP Response Codes

| Code | Reason |
|------|--------|
| 200 | Success with JSON body |
| 204 | Success (DELETE/PATCH) |
| 400 | Invalid request body or query |
| 401 | Invalid authentication token |
| 404 | Invalid API path or HTTP method |
| 429 | Throttled |
| 500 | Server error |
| 502 | Server is down |

## Tips & Tricks

### Pagination
Two approaches:
1. **Page-based**: Use `page` parameter. Simpler but less efficient for large sets.
2. **ID-based**: Sort by `id`, use `["id", ">", "v123"]` to fetch next page. More efficient when sorted on `id`.

### Fetching Multiple IDs
Batch up to 100 IDs with `or`:
```bash
curl https://api.vndb.org/kana/vn -H 'Content-Type: application/json' \
  -d '{"fields":"title","filters":["or",["id","=","v1"],["id","=","v2"],["id","=","v3"]],"results":100}'
```

### Random Entry
1. Get highest ID: `{"sort":"id","reverse":true,"results":1}`
2. Pick random vndbid between first and highest
3. Fetch: `{"filters":["id",">=","<random_id>"],"results":1}`

### Best Practices
- Always select only fields you need — the server rejects queries that would return too much data
- Cache `/schema` results for enum values and field lists
- Use `"count":false` unless you actually need the total count (performance impact)
- For fetching tags/traits across multiple VNs, select only `id` and batch-fetch details separately
- Fetch up to 100 entries per request rather than making 100 individual calls
