// AUTO-GENERATED from the TanStack route tree. Do not edit by hand.
export type LegacyRoute = { legacyId: string; pattern: string; file: string; kind: "page" | "layout" };
export const LEGACY_ROUTES: LegacyRoute[] = [
  { legacyId: "/$id/_layout", pattern: "/:id", file: "pages/[id]/_route.tsx", kind: "layout" },
  { legacyId: "/$id/_layout/comment", pattern: "/:id/comment", file: "pages/[id]/comment.tsx", kind: "page" },
  { legacyId: "/$id/_layout/", pattern: "/:id", file: "pages/[id]/index.tsx", kind: "page" },
  { legacyId: "/$id/_layout/introduction/$articleId", pattern: "/:id/introduction/:articleId", file: "pages/[id]/introduction/[articleId].tsx", kind: "page" },
  { legacyId: "/$id/_layout/introduction/", pattern: "/:id/introduction", file: "pages/[id]/introduction/index.tsx", kind: "page" },
  { legacyId: "/$id/_layout/relations", pattern: "/:id/relations", file: "pages/[id]/relations.tsx", kind: "page" },
  { legacyId: "/$id/_layout/translate", pattern: "/:id/translate", file: "pages/[id]/translate.tsx", kind: "page" },
  { legacyId: "/admin/_authL", pattern: "/admin", file: "pages/admin/_route.tsx", kind: "layout" },
  { legacyId: "/admin/_authL/adverts", pattern: "/admin/adverts", file: "pages/admin/adverts.tsx", kind: "page" },
  { legacyId: "/admin/_authL/articles/$articleId/edit", pattern: "/admin/articles/:articleId/edit", file: "pages/admin/articles/[articleId]/edit.tsx", kind: "page" },
  { legacyId: "/admin/_authL/articles", pattern: "/admin/articles", file: "pages/admin/articles.tsx", kind: "page" },
  { legacyId: "/admin/_authL/collections", pattern: "/admin/collections", file: "pages/admin/collections.tsx", kind: "page" },
  { legacyId: "/admin/_authL/comments", pattern: "/admin/comments", file: "pages/admin/comments.tsx", kind: "page" },
  { legacyId: "/admin/_authL/friend-links", pattern: "/admin/friend-links", file: "pages/admin/friend-links.tsx", kind: "page" },
  { legacyId: "/admin/_authL/", pattern: "/admin", file: "pages/admin/index.tsx", kind: "page" },
  { legacyId: "/admin/_authL/meilisearch", pattern: "/admin/meilisearch", file: "pages/admin/meilisearch.tsx", kind: "page" },
  { legacyId: "/admin/_authL/tasks", pattern: "/admin/tasks", file: "pages/admin/tasks.tsx", kind: "page" },
  { legacyId: "/admin/_authL/topics", pattern: "/admin/topics", file: "pages/admin/topics.tsx", kind: "page" },
  { legacyId: "/admin/_authL/users", pattern: "/admin/users", file: "pages/admin/users.tsx", kind: "page" },
  { legacyId: "/admin/_authL/vndb-sync", pattern: "/admin/vndb-sync", file: "pages/admin/vndb-sync.tsx", kind: "page" },
  { legacyId: "/auth/login", pattern: "/auth/login", file: "pages/auth/login.tsx", kind: "page" },
  { legacyId: "/auth/signup/Verification", pattern: "/auth/signup/Verification", file: "pages/auth/signup/Verification.tsx", kind: "page" },
  { legacyId: "/auth/signup/", pattern: "/auth/signup", file: "pages/auth/signup/index.tsx", kind: "page" },
  { legacyId: "/collections/$id", pattern: "/collections/:id", file: "pages/collections/[id].tsx", kind: "page" },
  { legacyId: "/collections/", pattern: "/collections", file: "pages/collections/index.tsx", kind: "page" },
  { legacyId: "/contact", pattern: "/contact", file: "pages/contact.tsx", kind: "page" },
  { legacyId: "/friend-links", pattern: "/friend-links", file: "pages/friend-links.tsx", kind: "page" },
  { legacyId: "/games/", pattern: "/games", file: "pages/games/index.tsx", kind: "page" },
  { legacyId: "/", pattern: "/", file: "pages/index.tsx", kind: "page" },
  { legacyId: "/introduction/$articleId/edit", pattern: "/introduction/:articleId/edit", file: "pages/introduction/[articleId]/edit.tsx", kind: "page" },
  { legacyId: "/introduction/create", pattern: "/introduction/create", file: "pages/introduction/create.tsx", kind: "page" },
  { legacyId: "/openapi", pattern: "/openapi", file: "pages/openapi.tsx", kind: "page" },
  { legacyId: "/producer/$pid", pattern: "/producer/:pid", file: "pages/producer/[pid].tsx", kind: "page" },
  { legacyId: "/producer/", pattern: "/producer", file: "pages/producer/index.tsx", kind: "page" },
  { legacyId: "/search/", pattern: "/search", file: "pages/search/index.tsx", kind: "page" },
  { legacyId: "/tags/$tagId", pattern: "/tags/:tagId", file: "pages/tags/[tagId].tsx", kind: "page" },
  { legacyId: "/tags/category/$categoryKey", pattern: "/tags/category/:categoryKey", file: "pages/tags/category/[categoryKey].tsx", kind: "page" },
  { legacyId: "/tags/", pattern: "/tags", file: "pages/tags/index.tsx", kind: "page" },
  { legacyId: "/tools/", pattern: "/tools", file: "pages/tools/index.tsx", kind: "page" },
  { legacyId: "/tools/plate", pattern: "/tools/plate", file: "pages/tools/plate.tsx", kind: "page" },
  { legacyId: "/topics/$topicId/edit", pattern: "/topics/:topicId/edit", file: "pages/topics/[topicId]/edit.tsx", kind: "page" },
  { legacyId: "/topics/$topicId", pattern: "/topics/:topicId", file: "pages/topics/[topicId].tsx", kind: "page" },
  { legacyId: "/topics/create", pattern: "/topics/create", file: "pages/topics/create.tsx", kind: "page" },
  { legacyId: "/topics/", pattern: "/topics", file: "pages/topics/index.tsx", kind: "page" },
  { legacyId: "/user/", pattern: "/user", file: "pages/user/index.tsx", kind: "page" },
];

const byLegacy = new Map<string, LegacyRoute>();
const byPattern = new Map<string, LegacyRoute>();
for (const r of LEGACY_ROUTES) { byLegacy.set(r.legacyId, r); byPattern.set(r.pattern, r); }

export function legacyToPattern(legacyId: string): string | undefined { return byLegacy.get(legacyId)?.pattern; }
export function patternToLegacy(pattern: string): string | undefined { return byPattern.get(pattern)?.legacyId; }

/** Convert a TanStack-style to-target (route id or concrete path) to a furin pattern. */
export function toFurinPattern(to: string): string {
  const direct = byLegacy.get(to) ?? byLegacy.get(to.startsWith("/") ? to : "/" + to);
  if (direct) return direct.pattern;
  const segs = (to.startsWith("/") ? to : "/" + to).split("/").filter(Boolean);
  const kept = [];
  for (const seg of segs) {
    if (seg === "_layout" || seg === "_authL") continue;
    kept.push(seg.startsWith("$") ? ":" + seg.slice(1) : seg);
  }
  return "/" + kept.join("/");
}

/** Resolve a concrete URL to its route entry by matching static segments and :params. */
export function matchPattern(pathname: string): LegacyRoute | undefined {
  const clean = pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
  let best: LegacyRoute | undefined;
  let bestScore = -1;
  for (const route of LEGACY_ROUTES) {
    const rp = route.pattern === "/" ? [] : route.pattern.split("/").filter(Boolean);
    const pp = clean === "/" ? [] : clean.split("/").filter(Boolean);
    if (rp.length !== pp.length) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < rp.length; i++) {
      const r = rp[i] as string;
      if (r.startsWith(":")) { score += 1; continue; }
      if (r === pp[i]) { score += 10; continue; }
      ok = false; break;
    }
    if (ok && score > bestScore) { bestScore = score; best = route; }
  }
  return best;
}

/** Layout route ids applying to a pathname, root-first (matches emulation). */
export function matchedRouteIds(pathname: string): string[] {
  const hit = matchPattern(pathname);
  const ids: string[] = ["/"];
  if (!hit) return ids;
  if (hit.legacyId.startsWith("/admin")) ids.push("/admin/_authL");
  if (hit.legacyId.startsWith("/$id/_layout")) ids.push("/$id/_layout");
  ids.push(hit.legacyId);
  return ids;
}
