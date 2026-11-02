import { useEffect, useState } from "react";

export type HeaderTone = "light" | "dark";

/** 采样顶栏背后可视区域的高度（顶栏 56px + 一点余量） */
const SAMPLE_HEIGHT = 72;
const SAMPLE_WIDTH = 32;
const SAMPLE_ROWS = 8;

/** 采样结果缓存：key 含图片 URL + 视口尺寸 + 叠层透明度 + 主题底色。
 * 只缓存最终那条 72px 的平均色，不缓存整张解码位图（1920×1080 ≈ 8MB）。 */
const sampleCache = new Map<string, [number, number, number]>();
const SAMPLE_CACHE_MAX = 8;
/** 颜色字符串 → RGB 缓存（getComputedStyle 结果随主题变化，按字符串缓存即可） */
const colorCache = new Map<string, [number, number, number]>();
/** 1×1 探针画布复用：原来每次 toRgb 都 createElement 一个 */
let probeCtx: CanvasRenderingContext2D | null | undefined;

/**
 * 顶栏透明态的自动对比度。
 *
 * 顶栏在页面顶部是完全透明的，正文背景图（/background.webp）可能是深色，
 * 主题 foregound 在深色图上会失去可读性。这里把背景图按 bg-cover/bg-center
 * 的映射取顶栏区域，与主题背景色按 background 层的 opacity 混合，算相对亮度，
 * 再比较「白字 / 深字」哪个对比度更高，输出 light（深色文字）或 dark（浅色文字）。
 *
 * - 只在顶栏透明（未滚动）时启用；滚动后会变成玻璃药丸，恢复主题色。
 * - 背景图是延迟注入的：MutationObserver 监听它的 style，图一出现就重算。
 * - 主题切换（html class 变化）与 resize 也会重算。
 */
export function useHeaderTone(enabled: boolean): HeaderTone | null {
	const [tone, setTone] = useState<HeaderTone | null>(null);

	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;

		const canvas = document.createElement("canvas");
		canvas.width = SAMPLE_WIDTH;
		canvas.height = SAMPLE_ROWS;
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return;

		const toRgb = (color: string): [number, number, number] => {
			const cached = colorCache.get(color);
			if (cached) return cached;
			if (probeCtx === undefined) {
				const probe = document.createElement("canvas");
				probe.width = 1;
				probe.height = 1;
				probeCtx = probe.getContext("2d", { willReadFrequently: true });
			}
			if (!probeCtx) return [255, 255, 255];
			// fillRect 是合成而非替换：带 alpha 的颜色会与上次结果混合，先清空
			probeCtx.clearRect(0, 0, 1, 1);
			probeCtx.fillStyle = color;
			probeCtx.fillRect(0, 0, 1, 1);
			const data = probeCtx.getImageData(0, 0, 1, 1).data;
			const rgb: [number, number, number] = [data[0], data[1], data[2]];
			colorCache.set(color, rgb);
			return rgb;
		};

		const channel = (value: number) => {
			const v = value / 255;
			return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		};

		// WCAG 相对亮度
		const luminance = ([r, g, b]: [number, number, number]) =>
			0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

		const contrast = (a: number, b: number) =>
			(a > b ? (a + 0.05) / (b + 0.05) : (b + 0.05) / (a + 0.05));

		const loadImage = (src: string) =>
			new Promise<HTMLImageElement | null>((resolve) => {
				const img = new Image();
				img.decoding = "async";
				img.onload = () => resolve(img);
				img.onerror = () => resolve(null);
				img.src = src;
			});

		const compute = async () => {
			if (cancelled) return;

			const bodyBg = toRgb(
				window.getComputedStyle(document.body).backgroundColor || "#ffffff",
			);
			const bgEl = document.querySelector<HTMLElement>("[data-app-background]");
			if (!bgEl) {
				if (!cancelled) {
					const lum = luminance(bodyBg);
					setTone(
						contrast(lum, 1) >= contrast(lum, 0.05) ? "dark" : "light",
					);
				}
				return;
			}

			const style = window.getComputedStyle(bgEl);
			const opacity = Number.parseFloat(style.opacity || "1");
			const match = style.backgroundImage.match(/url\((?:"|')?(.+?)(?:"|')?\)/);
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			// 采样结果按「图片 + 视口 + 叠层透明度 + 主题底色」缓存：
			// 只缓存最终那条平均色，位图用完即弃（整张 1920×1080 位图 ≈ 8MB）。
			const sampleKey = `${match?.[1] ?? ""}|${vw}|${vh}|${opacity}|${bodyBg.join(",")}`;
			const cachedSample = sampleCache.get(sampleKey);
			let sampled: [number, number, number] = cachedSample ?? bodyBg;

			if (!cachedSample && match?.[1]) {
				const img = await loadImage(match[1]);
				if (!img || cancelled) return;

				const iw = img.naturalWidth;
				const ih = img.naturalHeight;
				if (iw > 0 && ih > 0) {
					// 复刻 background-size: cover + background-position: center 的映射
					const scale = Math.max(vw / iw, vh / ih);
					const offsetX = (vw - iw * scale) / 2;
					const offsetY = (vh - ih * scale) / 2;
					const sx = Math.max(0, -offsetX / scale);
					const sy = Math.max(0, -offsetY / scale);
					const sw = Math.min(iw - sx, vw / scale);
					const sh = Math.min(ih - sy, SAMPLE_HEIGHT / scale);
					if (sw > 0 && sh > 0) {
						try {
							ctx.clearRect(0, 0, SAMPLE_WIDTH, SAMPLE_ROWS);
							ctx.drawImage(
								img,
								sx,
								sy,
								sw,
								sh,
								0,
								0,
								SAMPLE_WIDTH,
								SAMPLE_ROWS,
							);
							const data = ctx.getImageData(
								0,
								0,
								SAMPLE_WIDTH,
								SAMPLE_ROWS,
							).data;
							let r = 0;
							let g = 0;
							let b = 0;
							const count = data.length / 4;
							for (let i = 0; i < data.length; i += 4) {
								r += data[i];
								g += data[i + 1];
								b += data[i + 2];
							}
							const raw: [number, number, number] = [
								r / count,
								g / count,
								b / count,
							];
							// 背景图以 opacity 叠在主题背景上，换算成最终可见色
							sampled = [
								bodyBg[0] * (1 - opacity) + raw[0] * opacity,
								bodyBg[1] * (1 - opacity) + raw[1] * opacity,
								bodyBg[2] * (1 - opacity) + raw[2] * opacity,
							];
						} catch {
							// 跨域/画布被污染时退回主题背景色，不影响页面
							sampled = bodyBg;
						}
					}
				}

				// 只缓存真正采样成功的结果（sampled 与 bodyBg 是同一引用 = 走了回退分支）：
				// 画布污染是一次性失败，不该被永久固化到缓存里。
				if (sampled !== bodyBg) {
					if (sampleCache.size >= SAMPLE_CACHE_MAX) {
						const oldest = sampleCache.keys().next().value;
						if (oldest !== undefined) sampleCache.delete(oldest);
					}
					sampleCache.set(sampleKey, sampled);
				}
			}

			if (cancelled) return;
			const lum = luminance(sampled);
			// 比较白字与深字：谁对比度高就用谁
			setTone(contrast(lum, 1) >= contrast(lum, 0.05) ? "dark" : "light");
		};

		// resize / 样式变化可能连续触发：合并到一帧，避免重复解码背景图
		let raf = 0;
		const schedule = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				void compute();
			});
		};

		void compute();

		// 背景图延迟注入 / 主题切换：任一变化都重新采样
		const observer = new MutationObserver(schedule);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		const bgEl = document.querySelector<HTMLElement>("[data-app-background]");
		if (bgEl) {
			observer.observe(bgEl, { attributes: true, attributeFilter: ["style"] });
		}

		const onResize = schedule;
		window.addEventListener("resize", onResize);
		window.addEventListener("load", onResize);
		window.addEventListener("orientationchange", onResize);

		return () => {
			cancelled = true;
			if (raf) cancelAnimationFrame(raf);
			observer.disconnect();
			window.removeEventListener("resize", onResize);
			window.removeEventListener("load", onResize);
			window.removeEventListener("orientationchange", onResize);
		};
	}, [enabled]);

	return tone;
}
