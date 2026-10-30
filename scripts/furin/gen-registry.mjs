import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const implRoot = "apps/web-tanstack/src/server/impl";
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const files = walk(implRoot).map((p) => p.split("\\").join("/")).sort();
const imports = [];
const entries = [];
for (const file of files) {
  const rel = relative(implRoot, file).split("\\").join("/").replace(/\.ts$/, "");
  const name = rel.replace(/[^A-Za-z0-9]/g, "_");
  const src = readFileSync(file, "utf8");
  const names = [...src.matchAll(/export const (\w+) = defineBff(?:NoInput)?\(/g)].map((m) => m[1]);
  if (!names.length) continue;
  imports.push('import * as ' + name + ' from "@web/server/impl/' + rel + '";');
  for (const fn of names) entries.push('\t"' + rel.replace(/\/index$/, "").replace(/\//g, ".") + "." + fn + '": ' + name + "." + fn + ",");
}
const out = [];
out.push('import "@teyik0/furin/server-only";');
out.push(...imports);
out.push('import type { BffImplLike } from "@web/lib/bff/protocol";');
out.push("");
out.push("/**");
out.push(" * Server-side registry of every BFF handler (generated).");
out.push(" * Regenerate with: bun scripts/furin/gen-registry.mjs");
out.push(" */");
out.push("export const bffRegistry: Record<string, BffImplLike> = {");
out.push(...entries);
out.push("};");
out.push("");
writeFileSync("apps/web-tanstack/src/server/registry.ts", out.join("\n"));
console.log("impl files:", files.length, "entries:", entries.length);
