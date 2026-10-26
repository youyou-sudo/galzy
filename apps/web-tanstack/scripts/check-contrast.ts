/**
 * 设计令牌对比度闸门（WCAG 2.1 AA）
 *
 * 直接解析 src/styles.css 里的 :root / .dark 令牌，按真实配对计算对比度，
 * 不达标就非零退出。用途是防止后续阶段（P1–P5）改色时静默退化。
 *
 * 运行：bun scripts/check-contrast.ts
 *
 * 说明：只校验纯 oklch() 令牌。由 color-mix 派生的令牌（--accent 等）
 * 在 @supports 分支里，本脚本跳过并单独标注。
 */

const CSS_URL = new URL('../src/styles.css', import.meta.url);

type Block = Map<string, string>;
type Linear = { r: number; g: number; b: number };

/** 取选择器块内的 --token 声明。用括号配平而非正则，避免 CSS 内容里的特殊字符。 */
function readBlock(css: string, selector: string): Block {
  const out: Block = new Map();
  const start = css.indexOf('\n' + selector + ' {');
  if (start < 0) return out;
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const inner = css.slice(open + 1, end);
  const decl = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m = decl.exec(inner);
  while (m !== null) {
    out.set(m[1], m[2].trim());
    m = decl.exec(inner);
  }
  return out;
}

/** oklch(L C H) → linear sRGB。L 支持 0.55 与 55% 两种写法。 */
function oklchToLinear(token: string): Linear | null {
  const m = token.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return null;
  const L = m[2] === '%' ? Number(m[1]) / 100 : Number(m[1]);
  const C = Number(m[3]);
  const rad = (Number(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const luminance = (c: Linear) =>
  0.2126 * clamp01(c.r) + 0.7152 * clamp01(c.g) + 0.0722 * clamp01(c.b);

function contrast(a: Linear, b: Linear): number {
  const ya = luminance(a);
  const yb = luminance(b);
  return (Math.max(ya, yb) + 0.05) / (Math.min(ya, yb) + 0.05);
}

/** 解析令牌，跟随 var() 引用一层。 */
function resolve(block: Block, name: string, depth = 0): string | null {
  const raw = block.get(name);
  if (!raw) return null;
  const v = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (v && depth < 3) return resolve(block, v[1], depth + 1);
  return raw;
}

type Pair = { label: string; fg: string; bg: string; min: number };

const PAIRS: Pair[] = [
  { label: '按钮文字 / primary 填充', fg: '--primary-foreground', bg: '--primary', min: 4.5 },
  { label: '正文 / 画布', fg: '--foreground', bg: '--background', min: 4.5 },
  { label: '次要文字 / 画布', fg: '--muted-foreground', bg: '--background', min: 4.5 },
  { label: '次要文字 / 卡片', fg: '--muted-foreground', bg: '--card', min: 4.5 },
  { label: '链接色(primary) / 画布', fg: '--primary', bg: '--background', min: 4.5 },
  { label: 'success 文字 / 画布', fg: '--success', bg: '--background', min: 4.5 },
  { label: 'warning 文字 / 画布', fg: '--warning', bg: '--background', min: 4.5 },
  { label: 'info 文字 / 画布', fg: '--info', bg: '--background', min: 4.5 },
  { label: 'destructive 文字 / 画布', fg: '--destructive', bg: '--background', min: 4.5 },
  { label: 'success 反白文字', fg: '--success-foreground', bg: '--success', min: 4.5 },
  { label: 'warning 反白文字', fg: '--warning-foreground', bg: '--warning', min: 4.5 },
  { label: 'info 反白文字', fg: '--info-foreground', bg: '--info', min: 4.5 },
];

const css = await Bun.file(CSS_URL).text();
const light = readBlock(css, ':root');
const dark = readBlock(css, '.dark');

if (light.size === 0 || dark.size === 0) {
  console.error('未能从 styles.css 解析出 :root / .dark 令牌块');
  process.exit(1);
}

let checked = 0;
let failed = 0;

for (const [themeName, block] of [
  ['亮色', light],
  ['暗色', dark],
] as const) {
  console.log('\n' + themeName);
  for (const pair of PAIRS) {
    const fgToken = resolve(block, pair.fg);
    const bgToken = resolve(block, pair.bg);
    const fg = fgToken ? oklchToLinear(fgToken) : null;
    const bg = bgToken ? oklchToLinear(bgToken) : null;
    if (!fg || !bg) {
      console.log('  - 跳过（非纯 oklch）: ' + pair.label);
      continue;
    }
    checked++;
    const ratio = contrast(fg, bg);
    const ok = ratio >= pair.min;
    if (!ok) failed++;
    console.log(
      '  ' +
        (ok ? 'OK ' : 'FAIL') +
        ' ' +
        ratio.toFixed(2).padStart(5) +
        ':1 (需 ' +
        pair.min +
        ')  ' +
        pair.label,
    );
  }
}

console.log('\n校验 ' + checked + ' 对，失败 ' + failed + ' 对');
if (failed > 0) process.exit(1);
