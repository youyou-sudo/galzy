import { getRouteApi } from "@tanstack/react-router";
import { EmptyState } from "@web/components/shared/empty-state";
import { SectionHeader } from "@web/components/shared/section-header";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@web/components/ui/chart";
import { BarChart3, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

const chartConfig = {
	desktop: {
		label: "下载量",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const apiroute = getRouteApi("/$id/_layout/translate");

/**
 * 统计页签：总下载量 + 每日曲线。
 *
 * 不再自带 Card —— 外层 game-layout-page 的内容卡已经提供了圆角与发丝边，
 * 这里只做区块排版，避免「卡中卡」。
 */
export function ChartAreaLinear() {
	const { translateData } = apiroute.useLoaderData();
	const hasData = (translateData?.res?.length ?? 0) > 0;

	return (
		<section>
			<SectionHeader
				icon={TrendingUp}
				title="总下载量"
				count={translateData?.total ?? 0}
			/>
			{hasData ? (
				<ChartContainer className="max-h-52 w-full" config={chartConfig}>
					<AreaChart
						accessibilityLayer
						data={translateData?.res}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value: any) => value.slice(0, 3)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dot" hideLabel />}
						/>
						<Area
							dataKey="total"
							type="linear"
							fill="var(--color-desktop)"
							fillOpacity={0.4}
							stroke="var(--color-desktop)"
						/>
					</AreaChart>
				</ChartContainer>
			) : (
				<EmptyState
					icon={BarChart3}
					size="sm"
					title="暂无下载统计"
					description="有下载记录后这里会显示每日曲线"
				/>
			)}
		</section>
	);
}
