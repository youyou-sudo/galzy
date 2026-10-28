import { useQuery } from "@tanstack/react-query";
import {
	type AdSlotPayload,
	type PublicAdvert,
	TOP_AD_SLOT_KEY,
} from "@web/lib/adverts";
import { cn } from "@web/lib/utils";
import { adSlotQueryOptions, trackAdvert } from "@web/server/adverts";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 顶部广告位（广告位 key = `home_top`）。
 *
 * 数据模型与行业一致：广告位决定「在哪、同屏几条、手机端怎么展示」，
 * 素材决定「展示什么、给哪类设备、什么时段、轮换权重」。设备过滤、条数上限与
 * 权重轮换都在 API 侧完成，这里只负责布局、轮播与曝光/点击上报。
 *
 * 布局契约：
 * - 桌面（sm 及以上）：1 条整宽；多条两列网格（保持原设计，最多 4 条）；
 * - 手机（sm 以下）：按广告位 mobileMode 轮播 / 竖向堆叠 / 不展示；
 * - 无在投素材时整块不渲染。
 */
export function TopAdSlot() {
	const { data } = useQuery(adSlotQueryOptions(TOP_AD_SLOT_KEY));
	if (!data) return null;
	return <AdSlotView payload={data} />;
}

/** 纯展示组件：数据由调用方注入，便于单测覆盖各布局组合。 */
export function AdSlotView({ payload }: { payload: AdSlotPayload }) {
	const { slot, desktop, mobile } = payload;
	const showMobile = mobile.length > 0 && slot.mobileMode !== "hidden";

	if (desktop.length === 0 && !showMobile) return null;

	return (
		<aside
			id="sidebar-ad"
			data-ad-slot={slot.key}
			aria-label="广告"
			className="relative mx-auto mb-3 w-full max-w-5xl opacity-[0.65] transition-opacity duration-200 hover:opacity-90 focus-within:opacity-90"
		>
			{desktop.length > 0 ? (
				<div className="hidden sm:block" data-testid="advert-desktop">
					{desktop.length === 1 ? (
						<AdvertBanner advert={desktop[0]} />
					) : (
						<div className="grid grid-cols-2 gap-2">
							{desktop.map((advert) => (
								<AdvertBanner key={advert.id} advert={advert} />
							))}
						</div>
					)}
				</div>
			) : null}

			{showMobile ? (
				<div className="sm:hidden" data-testid="advert-mobile">
					{slot.mobileMode === "stack" ? (
						<div className="flex flex-col gap-2">
							{mobile.map((advert) => (
								<AdvertBanner key={advert.id} advert={advert} />
							))}
						</div>
					) : (
						<MobileAdvertCarousel
							adverts={mobile}
							intervalSeconds={slot.carouselInterval}
						/>
					)}
				</div>
			) : null}
		</aside>
	);
}

/**
 * 单条广告：整块可点，图片按原始比例铺满。
 *
 * 曝光：素材有 50% 可见并持续 1s 才计一次（行业常用的「可见曝光」口径），
 * 点击：跳转的同时 fire-and-forget 上报；两者失败都静默忽略。
 */
function AdvertBanner({ advert }: { advert: PublicAdvert }) {
	const ref = useRef<HTMLAnchorElement>(null);
	useAdvertImpression(ref, advert.id);

	return (
		<a
			ref={ref}
			href={advert.href}
			target="_blank"
			rel="noopener noreferrer"
			onClick={() => {
				void trackAdvert({ data: { id: advert.id, type: "click" } }).catch(
					() => {},
				);
			}}
			data-umami-event="广告点击"
			data-umami-event-name={advert.name}
			data-umami-event-position={`Banner-${advert.name}`}
			className="block overflow-hidden rounded-xl bg-muted ring-1 ring-border/50 outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-ring/60"
		>
			{/* 横幅按原始比例铺满；max-h-40 只是兜底：万一塞进一张竖图/方图，
			    不会把整个首屏撑变形，而是裁成一条横幅。正常横幅（≤160px 高）不受影响。 */}
			<img
				src={advert.image}
				alt={`${advert.name} 广告图片`}
				loading="lazy"
				fetchPriority="low"
				decoding="async"
				className="block w-full h-auto max-h-40 object-cover"
			/>
		</a>
	);
}

/** 可见曝光上报：50% 可见持续 1s 记一次，同一条广告每个挂载周期只报一次。 */
function useAdvertImpression(
	ref: React.RefObject<HTMLAnchorElement | null>,
	advertId: number,
) {
	useEffect(() => {
		const element = ref.current;
		if (!element || typeof IntersectionObserver === "undefined") return;

		let timer: number | undefined;
		let reported = false;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						if (reported || timer !== undefined) continue;
						timer = window.setTimeout(() => {
							timer = undefined;
							if (reported) return;
							reported = true;
							void trackAdvert({
								data: { id: advertId, type: "impression" },
							}).catch(() => {});
						}, 1000);
					} else if (timer !== undefined) {
						window.clearTimeout(timer);
						timer = undefined;
					}
				}
			},
			{ threshold: 0.5 },
		);

		observer.observe(element);
		return () => {
			observer.disconnect();
			if (timer !== undefined) window.clearTimeout(timer);
		};
	}, [ref, advertId]);
}

/** 把横向滚动位置换算成「当前第几条」，滚动与自动轮播都以它为准，避免两份状态互相抢。 */
function readIndex(track: HTMLDivElement): number {
	const width = track.clientWidth || 1;
	return Math.round(track.scrollLeft / width);
}

/**
 * 手机端广告轮播。
 *
 * 用原生 scroll-snap 承载手势（不引入轮播依赖）：左右滑动天然可用，
 * 自动轮播只是定时把轨道滚到下一屏；间隔由广告位配置决定（0 = 不自动），
 * 悬停 / 触摸 / 键盘聚焦时暂停，尊重系统「减少动态效果」偏好，页面不可见时也不推进。
 */
function MobileAdvertCarousel({
	adverts,
	intervalSeconds,
}: {
	adverts: PublicAdvert[];
	intervalSeconds: number;
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const count = adverts.length;
	const intervalMs = intervalSeconds > 0 ? intervalSeconds * 1000 : 0;

	// 后台调整投放后列表会变短：索引越界时回到第一条，避免圆点停在不存在的位置
	useEffect(() => {
		if (index > count - 1) setIndex(0);
	}, [count, index]);

	const scrollToIndex = useCallback(
		(next: number) => {
			const track = trackRef.current;
			if (!track) return;
			const target = ((next % count) + count) % count;
			const left = target * (track.clientWidth || 0);
			// jsdom / 老 WebView 没有 scrollTo：退化成直接赋值，保证索引行为一致
			if (typeof track.scrollTo === "function") {
				track.scrollTo({ left, behavior: "smooth" });
			} else {
				track.scrollLeft = left;
			}
			setIndex(target);
		},
		[count],
	);

	useEffect(() => {
		if (count <= 1 || intervalMs === 0 || paused) return;
		const reduceMotion =
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduceMotion) return;

		const timer = window.setInterval(() => {
			const track = trackRef.current;
			if (!track || document.visibilityState === "hidden") return;
			// 桌面端 carousel 被 sm:hidden 隐藏，定时器不该在不可见时做无用滚动
			if (
				typeof window.matchMedia === "function" &&
				!window.matchMedia("(max-width: 639px)").matches
			) {
				return;
			}
			const next = (readIndex(track) + 1) % count;
			const left = next * (track.clientWidth || 0);
			if (typeof track.scrollTo === "function") {
				track.scrollTo({ left, behavior: "smooth" });
			} else {
				track.scrollLeft = left;
			}
			setIndex(next);
		}, intervalMs);

		return () => window.clearInterval(timer);
	}, [count, intervalMs, paused]);

	const handleScroll = () => {
		const track = trackRef.current;
		if (!track) return;
		const next = readIndex(track);
		setIndex((previous) => (previous === next ? previous : next));
	};

	return (
		<div>
			<div
				ref={trackRef}
				role="group"
				aria-roledescription="轮播"
				aria-label="广告轮播"
				onScroll={handleScroll}
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
				onFocusCapture={() => setPaused(true)}
				onBlurCapture={() => setPaused(false)}
				onPointerDown={() => setPaused(true)}
				className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
			>
				{adverts.map((advert, slideIndex) => (
					<div
						key={advert.id}
						data-testid="advert-mobile-slide"
						role="group"
						aria-roledescription="幻灯片"
						aria-label={`第 ${slideIndex + 1} 条，共 ${count} 条`}
						className="w-full shrink-0 snap-center"
					>
						<AdvertBanner advert={advert} />
					</div>
				))}
			</div>

			{count > 1 ? (
				<div className="flex gap-1.5 justify-center mt-1.5">
					{adverts.map((advert, dotIndex) => (
						<button
							key={advert.id}
							type="button"
							onClick={() => scrollToIndex(dotIndex)}
							aria-label={`查看第 ${dotIndex + 1} 条广告`}
							aria-current={dotIndex === index ? "true" : undefined}
							className="grid place-items-center rounded-full size-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
						>
							<span
								className={cn(
									"block h-1.5 rounded-full transition-all duration-200",
									dotIndex === index
										? "w-4 bg-foreground/70"
										: "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60",
								)}
							/>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
