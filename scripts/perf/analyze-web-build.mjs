#!/usr/bin/env node
/**
 * analyze-web-build.mjs - 只读测量 Galzy Web 首屏资源优先级与体积
 *
 * 数据来源：
 *   1. .output/public/assets：原始体积 + 同名 .br/.gz 预压缩体积；
 *   2. .output/public/.vite/ssr-manifest.json：SSR 路由 chunk 映射（只读统计）；
 *   3. 可选：抓取 SSR 首页 HTML（或 --html 读入已保存的 HTML），统计 head 中
 *      modulepreload / image preload / stylesheet / script 的数量、顺序、
 *      fetchpriority 分布与 raw/br 体积。
 *
 * 只读：不写文件、不启动服务、不修改产物。SSR 服务没起时自动跳过 HTML 部分。
 *
 * 用法：
 *   node scripts/perf/analyze-web-build.mjs
 *   node scripts/perf/analyze-web-build.mjs --url http://127.0.0.1:3000 --path /
 *   node scripts/perf/analyze-web-build.mjs --html .tmp/home.html
 *   node scripts/perf/analyze-web-build.mjs --json > report.json
 *
 * 选项：
 *   --url <url>     SSR 服务地址（默认 http://127.0.0.1:3000）
 *   --path <path>   抓取的路径（默认 /）
 *   --html <file>   分析已保存的 HTML（优先于 --url，不发起请求）
 *   --dist <dir>    client 产物目录（默认 apps/web-tanstack/.output/public）
 *   --top <n>       顺序列表最多打印多少条资源标签（默认 12）
 *   --timeout <ms>  HTML 请求超时（默认 5000）
 *   --json          输出 JSON（便于两次构建对比 / CI）
 *   -h, --help      显示帮助
 *
 * exit code：0 = 完成（即使 SSR 服务不可达）；1 = 参数错误；2 = dist 与 HTML 均不可用
 */

import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

const DEFAULTS = {
	url: "http://127.0.0.1:3000",
	path: "/",
	// Nitro（bun preset）把客户端产物写到 .output/public；旧的 dist/client 已不再生成。
	dist: path.join(REPO_ROOT, "apps", "web-tanstack", ".output", "public"),
	top: 12,
	timeout: 5000,
	html: null,
	json: false,
};

const HELP = [
	"analyze-web-build.mjs - 只读测量 Galzy Web 首屏资源优先级与体积",
	"",
	"用法：",
	"  node scripts/perf/analyze-web-build.mjs [options]",
	"",
	"选项：",
	"  --url <url>     SSR 服务地址（默认 http://127.0.0.1:3000）",
	"  --path <path>   抓取的路径（默认 /）",
	"  --html <file>   分析已保存的 HTML（优先于 --url）",
	"  --dist <dir>    client 产物目录（默认 apps/web-tanstack/.output/public）",
	"  --top <n>       顺序列表最多打印多少条（默认 12）",
	"  --timeout <ms>  HTML 请求超时（默认 5000）",
	"  --json          输出 JSON",
	"  -h, --help      显示帮助",
].join("\n");

// ------------------------------------------------------------------ CLI

function parseArgs(argv) {
	const opts = { ...DEFAULTS };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const need = () => {
			const value = argv[++i];
			if (value == null) throw new Error("缺少参数值：" + arg);
			return value;
		};
		switch (arg) {
			case "--url":
				opts.url = need().replace(/\/+$/, "");
				break;
			case "--path":
				opts.path = need();
				break;
			case "--html":
				opts.html = path.resolve(process.cwd(), need());
				break;
			case "--dist":
				opts.dist = path.resolve(process.cwd(), need());
				break;
			case "--top":
				opts.top = Number.parseInt(need(), 10);
				break;
			case "--timeout":
				opts.timeout = Number.parseInt(need(), 10);
				break;
			case "--json":
				opts.json = true;
				break;
			case "-h":
			case "--help":
				opts.help = true;
				break;
			default:
				throw new Error("未知参数：" + arg);
		}
	}
	return opts;
}

// ------------------------------------------------------------------ 格式化

function fmtBytes(bytes) {
	if (bytes == null || Number.isNaN(bytes)) return "?";
	if (bytes < 1024) return bytes + " B";
	const units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unit = units[0];
	for (let i = 1; value >= 1024 && i < units.length; i++) {
		value /= 1024;
		unit = units[i];
	}
	return (value >= 100 ? value.toFixed(0) : value.toFixed(1)) + " " + unit;
}

function fmtPct(part, total) {
	if (!total) return "n/a";
	return ((part / total) * 100).toFixed(1) + "%";
}

function sumBytes(links, pick) {
	return links.reduce((acc, link) => acc + (pick(link) ?? 0), 0);
}

// ------------------------------------------------------------------ 产物清单

const ASSET_KINDS = ["js", "css", "image", "font", "other"];
const IMAGE_EXT = [".webp", ".avif", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg"];

async function walk(dir) {
	const out = [];
	const pending = [dir];
	while (pending.length > 0) {
		const current = pending.pop();
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) pending.push(full);
			else if (entry.isFile()) out.push(full);
		}
	}
	return out;
}

async function loadInventory(distRoot) {
	const inventory = {
		root: distRoot,
		exists: existsSync(distRoot),
		files: new Map(),
		assets: [],
		totals: {},
	};
	for (const kind of ASSET_KINDS) {
		inventory.totals[kind] = { count: 0, raw: 0, br: 0, brEffective: 0, missingBr: 0 };
	}
	if (!inventory.exists) return inventory;

	const all = await walk(distRoot);
	const sizeOf = new Map();
	for (const file of all) {
		try {
			sizeOf.set(file, (await stat(file)).size);
		} catch {
			sizeOf.set(file, null);
		}
	}

	for (const file of all) {
		if (/\.(br|gz)$/.test(file)) continue;
		inventory.files.set(file, {
			raw: sizeOf.get(file) ?? null,
			br: sizeOf.get(file + ".br") ?? null,
			gz: sizeOf.get(file + ".gz") ?? null,
		});
	}

	const assetsPrefix = path.join(distRoot, "assets") + path.sep;
	for (const file of all) {
		if (!file.startsWith(assetsPrefix)) continue;
		if (/\.(br|gz)$/.test(file)) continue;
		const info = inventory.files.get(file) ?? { raw: null, br: null };
		const ext = path.extname(file).toLowerCase();
		let kind = "other";
		if (ext === ".js" || ext === ".mjs") kind = "js";
		else if (ext === ".css") kind = "css";
		else if (IMAGE_EXT.includes(ext)) kind = "image";
		else if (ext === ".woff" || ext === ".woff2") kind = "font";

		const raw = info.raw ?? 0;
		const totals = inventory.totals[kind];
		totals.count += 1;
		totals.raw += raw;
		if (info.br == null) {
			totals.missingBr += 1;
			totals.brEffective += raw;
		} else {
			totals.br += info.br;
			totals.brEffective += info.br;
		}
		inventory.assets.push({
			rel: path.relative(distRoot, file).split(path.sep).join("/"),
			kind,
			raw: info.raw,
			br: info.br,
		});
	}
	return inventory;
}

function resolveAsset(inventory, href) {
	if (!href) return null;
	let pathname;
	try {
		pathname = new URL(href, "http://localhost").pathname;
	} catch {
		return null;
	}
	try {
		pathname = decodeURIComponent(pathname);
	} catch {
		// 保留未解码路径
	}
	const rel = path.posix.normalize(pathname).replace(/^\/+/, "");
	const full = path.join(inventory.root, rel);
	const relative = path.relative(inventory.root, full);
	if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
	const info = inventory.files.get(full);
	if (!info) return { file: null, raw: null, br: null };
	return { file: full, raw: info.raw, br: info.br };
}

// ------------------------------------------------------------------ HTML 解析

function parseAttrs(raw) {
	const attrs = Object.create(null);
	const re = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>]+))?/g;
	let match = re.exec(raw);
	while (match) {
		const name = match[1].toLowerCase();
		let value = match[2] ?? "";
		if (value.startsWith('"') || value.startsWith("'")) {
			value = value.slice(1, -1);
		}
		attrs[name] = value;
		match = re.exec(raw);
	}
	return attrs;
}

function analyzeHead(html) {
	const headEnd = html.search(/<\/head\s*>/i);
	const head = headEnd >= 0 ? html.slice(0, headEnd + 7) : html;
	const tagRe = /<(link|script|style)\b([^>]*)>/gi;
	const tags = [];
	let match = tagRe.exec(head);
	while (match) {
		tags.push({
			index: tags.length,
			tag: match[1].toLowerCase(),
			attrs: parseAttrs(match[2]),
		});
		match = tagRe.exec(head);
	}

	const modulepreloads = [];
	const imagePreloads = [];
	const stylesheets = [];
	const otherPreloads = [];
	const scripts = [];
	const inlineStyles = [];

	for (const item of tags) {
		const attrs = item.attrs;
		const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
		const as = (attrs.as ?? "").toLowerCase();
		const fetchPriority = (attrs.fetchpriority ?? "").toLowerCase();
		if (item.tag === "link") {
			if (rel.includes("modulepreload")) {
				modulepreloads.push({
					index: item.index,
					href: attrs.href ?? "",
					fetchPriority: fetchPriority || "none",
				});
			} else if (rel.includes("stylesheet")) {
				stylesheets.push({ index: item.index, href: attrs.href ?? "" });
			} else if (rel.includes("preload") && as === "image") {
				imagePreloads.push({
					index: item.index,
					href: attrs.href ?? "",
					fetchPriority: fetchPriority || "none",
				});
			} else if (rel.includes("preload")) {
				otherPreloads.push({
					index: item.index,
					href: attrs.href ?? "",
					as,
					fetchPriority: fetchPriority || "none",
				});
			}
		} else if (item.tag === "script") {
			scripts.push({
				index: item.index,
				src: attrs.src ?? null,
				type: attrs.type ?? "",
				async: "async" in attrs,
				defer: "defer" in attrs,
			});
		} else if (item.tag === "style") {
			inlineStyles.push({ index: item.index });
		}
	}

	const priorityDistribution = { high: 0, low: 0, none: 0 };
	for (const link of modulepreloads) {
		priorityDistribution[link.fetchPriority] =
			(priorityDistribution[link.fetchPriority] ?? 0) + 1;
	}

	return {
		headBytes: Buffer.byteLength(head, "utf8"),
		htmlBytes: Buffer.byteLength(html, "utf8"),
		tags,
		modulepreloads,
		imagePreloads,
		stylesheets,
		otherPreloads,
		scripts,
		inlineStyles,
		priorityDistribution,
		firstStylesheet: stylesheets[0]?.index ?? null,
		firstModulepreload: modulepreloads[0]?.index ?? null,
		firstImagePreload: imagePreloads[0]?.index ?? null,
		firstScript: scripts[0]?.index ?? null,
	};
}

function withSizes(inventory, links) {
	return links.map((link) => {
		const resolved = resolveAsset(inventory, link.href);
		return {
			...link,
			raw: resolved?.raw ?? null,
			br: resolved?.br ?? null,
			inDist: Boolean(resolved?.file),
		};
	});
}

function buildOrder(head) {
	const entries = [];
	for (const item of head.tags) {
		const attrs = item.attrs;
		if (item.tag === "link") {
			const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/);
			let kind = "link[" + rel.join(" ") + "]";
			if (rel.includes("modulepreload")) kind = "modulepreload";
			else if (rel.includes("stylesheet")) kind = "stylesheet";
			else if (rel.includes("preload")) {
				kind = "preload" + (attrs.as ? " as=" + attrs.as : "");
			}
			entries.push({ index: item.index, kind, href: attrs.href ?? "" });
		} else if (item.tag === "script") {
			entries.push({
				index: item.index,
				kind: attrs.src ? "script" : "inline-script",
				href: attrs.src ?? "(inline)",
			});
		} else if (item.tag === "style") {
			entries.push({ index: item.index, kind: "inline-style", href: "(inline)" });
		}
	}
	return entries;
}

async function loadHtml(opts) {
	if (opts.html) {
		const html = await readFile(opts.html, "utf8");
		return { html, source: "file " + opts.html };
	}
	const url = new URL(opts.path, opts.url + "/").toString();
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(opts.timeout),
			headers: { "user-agent": "galzy-perf-analyze/1.0" },
		});
		if (!response.ok) {
			return { html: null, source: url, error: "HTTP " + response.status };
		}
		return { html: await response.text(), source: url };
	} catch (error) {
		return {
			html: null,
			source: url,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ------------------------------------------------------------------ ssr-manifest

async function loadSsrManifest(distRoot) {
	const file = path.join(distRoot, ".vite", "ssr-manifest.json");
	if (!existsSync(file)) return null;
	try {
		const manifest = JSON.parse(await readFile(file, "utf8"));
		const assets = new Set();
		for (const value of Object.values(manifest)) {
			if (!Array.isArray(value)) continue;
			for (const href of value) assets.add(href);
		}
		return {
			file,
			entries: Object.keys(manifest).length,
			uniqueAssets: assets.size,
		};
	} catch {
		return null;
	}
}

// ------------------------------------------------------------------ 汇总

function computeReport(context) {
	const { inventory, head, htmlSource, htmlError, manifest, top } = context;
	const report = {
		generatedAt: new Date().toISOString(),
		dist: inventory.root,
		distExists: inventory.exists,
		html: { source: htmlSource, error: htmlError ?? null, ok: Boolean(head) },
		assets: inventory.totals,
		manifest: manifest
			? {
					file: manifest.file,
					entries: manifest.entries,
					uniqueAssets: manifest.uniqueAssets,
				}
			: null,
		head: null,
		checks: [],
	};
	if (!head) return report;

	const modulepreloads = withSizes(inventory, head.modulepreloads);
	const stylesheets = withSizes(inventory, head.stylesheets);
	const imagePreloads = withSizes(inventory, head.imagePreloads);
	const otherPreloads = withSizes(inventory, head.otherPreloads);
	const jsTotals = inventory.totals.js;

	const modulepreloadRaw = sumBytes(modulepreloads, (l) => l.raw);
	const modulepreloadBr = sumBytes(modulepreloads, (l) => l.br ?? l.raw);
	const stylesheetRaw = sumBytes(stylesheets, (l) => l.raw);
	const stylesheetBr = sumBytes(stylesheets, (l) => l.br ?? l.raw);
	const imageRaw = sumBytes(imagePreloads, (l) => l.raw);
	const order = buildOrder(head);

	report.head = {
		headBytes: head.headBytes,
		htmlBytes: head.htmlBytes,
		counts: {
			modulepreload: modulepreloads.length,
			stylesheet: stylesheets.length,
			imagePreload: imagePreloads.length,
			otherPreload: otherPreloads.length,
			script: head.scripts.length,
			inlineScript: head.scripts.filter((s) => !s.src).length,
			inlineStyle: head.inlineStyles.length,
		},
		priorityDistribution: head.priorityDistribution,
		modulepreloads,
		stylesheets,
		imagePreloads,
		otherPreloads,
		scripts: head.scripts,
		totals: {
			modulepreloadRaw,
			modulepreloadBr,
			modulepreloadMissingSizes: modulepreloads.filter((l) => l.raw == null).length,
			stylesheetRaw,
			stylesheetBr,
			imageRaw,
		},
		shareOfClientJs: {
			raw: jsTotals.raw ? modulepreloadRaw / jsTotals.raw : null,
			br: jsTotals.brEffective ? modulepreloadBr / jsTotals.brEffective : null,
		},
		firstPositions: {
			stylesheet: head.firstStylesheet,
			modulepreload: head.firstModulepreload,
			imagePreload: head.firstImagePreload,
			script: head.firstScript,
		},
		order: order.slice(0, top),
		orderTotal: order.length,
	};

	const lowCount = head.priorityDistribution.low ?? 0;
	const highCount = head.priorityDistribution.high ?? 0;
	const noneCount = head.priorityDistribution.none ?? 0;
	report.checks = [
		{
			name: "stylesheet before first modulepreload",
			pass:
				head.firstStylesheet == null ||
				head.firstModulepreload == null ||
				head.firstStylesheet < head.firstModulepreload,
		},
		{
			name: "no image preload before stylesheet",
			pass:
				head.firstImagePreload == null ||
				head.firstStylesheet == null ||
				head.firstImagePreload > head.firstStylesheet,
		},
		{
			name: "no modulepreload with fetchpriority=low",
			pass: modulepreloads.length > 0 && lowCount === 0,
			detail: "high=" + highCount + " low=" + lowCount + " none=" + noneCount,
		},
		{
			name: "modulepreload count below 120",
			pass: modulepreloads.length < 120,
			detail: modulepreloads.length + " links",
		},
		{
			// Vite 预压缩阈值为 1025 B：更小的 chunk 不生成 .br 是预期行为，
			// 只有 >= 1 KB 却没有 .br 才说明 clientPrecompression 漏了文件。
			name: "critical js >= 1 KB has brotli sidecar",
			pass:
				modulepreloads.length > 0 &&
				modulepreloads.every(
					(l) => l.raw == null || l.br != null || l.raw < 1025,
				),
			detail:
				modulepreloads.filter(
					(l) => l.raw != null && l.br == null && l.raw >= 1025,
				).length + " large links without .br",
		},
	];
	return report;
}

// ------------------------------------------------------------------ 输出

function printReport(report) {
	const out = [];
	const rule = "=".repeat(72);
	const row = (label, text) => out.push("  " + label.padEnd(15) + text);
	out.push(rule);
	out.push("Galzy web build - resource priority report");
	out.push(rule);
	out.push("dist: " + report.dist + (report.distExists ? "" : " (MISSING)"));
	out.push(
		"html: " +
			(report.html.ok
				? report.html.source
				: "skipped (" + (report.html.error ?? "unavailable") + ")"),
	);

	if (report.distExists) {
		const totals = report.assets;
		out.push("");
		out.push("[1] client assets inventory (.output/public/assets)");
		row("js", String(totals.js.count).padStart(4) + " files  " +
			fmtBytes(totals.js.raw).padStart(10) + " raw / " +
			fmtBytes(totals.js.brEffective).padStart(10) + " br-effective");
		row("css", String(totals.css.count).padStart(4) + " files  " +
			fmtBytes(totals.css.raw).padStart(10) + " raw / " +
			fmtBytes(totals.css.brEffective).padStart(10) + " br-effective");
		row("image", String(totals.image.count).padStart(4) + " files  " +
			fmtBytes(totals.image.raw).padStart(10) + " raw");
		row("font", String(totals.font.count).padStart(4) + " files  " +
			fmtBytes(totals.font.raw).padStart(10) + " raw");
		row(
			"note",
			"files below the 1025 B precompression threshold have no .br; " +
				"counted as raw (js " + totals.js.missingBr + ", css " + totals.css.missingBr + ").",
		);
	}

	if (report.head) {
		const head = report.head;
		out.push("");
		out.push("[2] SSR <head> resources");
		row(
			"modulepreload",
			String(head.counts.modulepreload).padStart(4) +
				"   fetchpriority: high=" + (head.priorityDistribution.high ?? 0) +
				" low=" + (head.priorityDistribution.low ?? 0) +
				" none=" + (head.priorityDistribution.none ?? 0),
		);
		row(
			"bytes",
			fmtBytes(head.totals.modulepreloadRaw).padStart(10) + " raw / " +
				fmtBytes(head.totals.modulepreloadBr).padStart(10) + " br" +
				(head.totals.modulepreloadMissingSizes
					? "   (" + head.totals.modulepreloadMissingSizes + " hrefs not in dist)"
					: ""),
		);
		row(
			"share of js",
			fmtPct(head.shareOfClientJs.raw, head.shareOfClientJs.raw ? 1 : 0) +
				" raw / " +
				fmtPct(head.shareOfClientJs.br, head.shareOfClientJs.br ? 1 : 0) +
				" br-effective",
		);
		row(
			"stylesheet",
			String(head.counts.stylesheet).padStart(4) + "   " +
				fmtBytes(head.totals.stylesheetRaw) + " raw / " +
				fmtBytes(head.totals.stylesheetBr) + " br",
		);
		row(
			"image preload",
			String(head.counts.imagePreload).padStart(4) + "   " +
				fmtBytes(head.totals.imageRaw) + " raw" +
				(head.imagePreloads.length
					? "   [" + head.imagePreloads.map((i) => i.href).join(", ") + "]"
					: ""),
		);
		row(
			"other preload",
			String(head.counts.otherPreload).padStart(4) +
				(head.otherPreloads.length
					? "   [" +
						head.otherPreloads.map((p) => (p.as || "?") + ":" + p.href).join(", ") +
						"]"
					: ""),
		);
		row(
			"scripts",
			String(head.counts.script).padStart(4) + "   inline=" +
				head.counts.inlineScript + "  inline styles=" + head.counts.inlineStyle,
		);
		row("head", fmtBytes(head.headBytes) + " / html " + fmtBytes(head.htmlBytes));

		out.push("");
		out.push("[3] first-resource order in head");
		for (const entry of head.order) {
			out.push(
				"  #" + String(entry.index).padStart(3) + " " +
					entry.kind.padEnd(22) + " " + entry.href,
			);
		}
		if (head.orderTotal > head.order.length) {
			out.push("  ... " + (head.orderTotal - head.order.length) + " more");
		}

		out.push("");
		out.push("[4] checks");
		for (const check of report.checks) {
			out.push(
				"  " + (check.pass ? "PASS" : "FAIL") + "  " + check.name +
					(check.detail ? "  (" + check.detail + ")" : ""),
			);
		}
	}

	if (report.manifest) {
		out.push("");
		out.push("[5] ssr-manifest");
		row(
			"entries",
			report.manifest.entries + " source-module entries -> " +
				report.manifest.uniqueAssets + " unique assets",
		);
	}

	out.push("");
	return out.join("\n");
}

// ------------------------------------------------------------------ main

async function main() {
	let opts;
	try {
		opts = parseArgs(process.argv.slice(2));
	} catch (error) {
		console.error("");
		console.error(error.message);
		console.error("");
		console.error(HELP);
		process.exit(1);
	}
	if (opts.help) {
		console.log(HELP);
		return;
	}

	const inventory = await loadInventory(opts.dist);
	const manifest = inventory.exists ? await loadSsrManifest(opts.dist) : null;
	const { html, source, error } = await loadHtml(opts);
	const head = html ? analyzeHead(html) : null;
	const report = computeReport({
		inventory,
		head,
		htmlSource: source,
		htmlError: error,
		manifest,
		top: opts.top,
	});

	if (opts.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(printReport(report));
		if (!inventory.exists) {
			console.error(
				"警告：目录不存在 " + opts.dist +
					"；请先构建（bun --cwd apps/web-tanstack build）。",
			);
		}
		if (error) {
			console.error(
				"提示：未能读取 SSR HTML（" + error +
					"）。可先启动 SSR 服务，或用 --html <file> 分析已保存的 HTML。",
			);
		}
	}
	if (!inventory.exists && !head) process.exit(2);
}

main().catch((error) => {
	console.error(error);
	process.exit(2);
});
