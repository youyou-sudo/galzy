import { Image } from "@unpic/react";

/**
 * 登录 / 注册 / 验证页统一的品牌标识：站点头像 + GalZY 字标。
 *
 * 只在账户入口出现，视觉与顶栏左侧的站点标识同源（同尺寸圆角 + 发丝边），
 * 不做第二套品牌表达。
 */
export function BrandMark() {
	return (
		<span className="mb-1 flex items-center justify-center gap-2">
			{/* 与顶栏一致：站标不放进 overflow-hidden 的圆角容器，避免裁掉四角 */}
			<span className="flex size-7 items-center justify-center">
				<Image src="/favicon.ico" width={28} height={28} alt="" />
			</span>
			<span className="text-sm font-semibold tracking-tight text-foreground/80">
				GalZY
			</span>
		</span>
	);
}
