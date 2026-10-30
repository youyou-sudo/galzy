// Scan createServerFn chains without a TS AST (typescript@7 exports no JS compiler API).
export function matchPair(src, start, open, close) {
  let depth = 0, i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i < 0) return -1; continue; }
    if (ch === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2); if (i < 0) return -1; i += 2; continue; }
    if (ch === "\"" || ch === "\x27" || ch === "`") { const q = ch; i++; while (i < src.length) { if (src[i] === "\\") { i += 2; continue; } if (src[i] === q) break; i++; } i++; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}
export function scanServerFns(src, file) {
  const out = [];
  const marker = "createServerFn";
  let idx = 0;
  while ((idx = src.indexOf(marker, idx)) >= 0) {
    const before = src.slice(Math.max(0, idx - 200), idx);
    const nameMatch = before.match(/export const (\w+)\s*=\s*$/);
    if (!nameMatch) { idx += marker.length; continue; }
    const name = nameMatch[1];
    let p = src.indexOf("(", idx);
    if (p < 0) { idx += marker.length; continue; }
    let end = matchPair(src, p, "(", ")");
    if (end < 0) { idx += marker.length; continue; }
    let chainEnd = end + 1;
    let validator = null, handler = null, options = null;
    options = src.slice(p + 1, end).trim();
    // walk chained calls
    let j = chainEnd;
    while (true) {
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] !== ".") break;
      const m = src.slice(k + 1).match(/^(\w+)\s*\(/);
      if (!m) break;
      const callName = m[1];
      const open = k + 1 + m[0].length - 1;
      const close = matchPair(src, open, "(", ")");
      if (close < 0) break;
      const arg = src.slice(open + 1, close);
      if (callName === "validator" || callName === "inputValidator") validator = arg.trim();
      if (callName === "handler") handler = arg.trim();
      j = close + 1;
    }
    chainEnd = j;
    out.push({ file, name, options, validator, handler, start: idx, end: chainEnd });
    idx = chainEnd;
  }
  return out;
}