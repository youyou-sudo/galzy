import { getRouteApi } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, LineChart, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@web/components/ui/chart";

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const apiroute = getRouteApi("/$id/_layout/translate");

export function ChartAreaLinear() {
	const { translateData } = apiroute.useLoaderData();
	return (
		<Card>
			<CardHeader>
				<CardTitle>总下载量: {translateData?.total}</CardTitle>
			</CardHeader>
			<CardContent>
				<LineChart accessibilityLayer />
				<ChartContainer className="max-h-50 w-full" config={chartConfig}>
					<AreaChart
						accessibilityLayer
						data={translateData?.res.rows}
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
			</CardContent>
		</Card>
	);
}
