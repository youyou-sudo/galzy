/** biome-ignore-all lint/suspicious/noExplicitAny: <any> */
import { getRouteApi } from "@tanstack/react-router";
import { GameCard } from "../card";

const routeApi = getRouteApi("/search/");

interface HitDoc {
	id: string;
	olang: string | null;
	titles_obj?: Array<{ title: string; latin: string | null; lang: string }>;
	images?: {
		id: string;
		width: number;
		height: number;
		c_sexual_avg: number;
		imageUrl?: string | null;
	} | null;
	otherData?: {
		id: number;
		other: number;
		title?: Array<{ lang: string; title: string }>;
		alias?: string;
		other_media?: Array<{
			cover?: boolean;
			media?: {
				id: string;
				width: number;
				height: number;
				imageUrl?: string | null;
			};
		}>;
	};
}

const SearchlistComponent = () => {
	const { searchdata } = routeApi.useLoaderData();
	const hits = (searchdata?.hits ?? []) as HitDoc[];

	if (hits.length === 0) {
		return (
			<div className="flex text-center font-bold justify-center items-center">
				喵~没有找到哦 🐾，可以尝试其他关键字喵～💕
			</div>
		);
	}

	return (
		<>
			{hits.map((item) => {
				const imagesData = item.otherData?.other_media?.some(
					(m: any) => m.cover === true,
				)
					? item.otherData.other_media.find((m: any) => m.cover === true)?.media
					: item.images;

				const imagess =
					imagesData?.imageUrl ?? "/No-Image-Placeholder.svg.webp";

				const titleObj = item.titles_obj;
				const displayTitle =
					item.otherData?.title?.find((it) => it.lang === "zh-Hans")?.title ??
					item.otherData?.title?.[0]?.title ??
					titleObj?.find((it) => it.lang === item.olang)?.title ??
					titleObj?.[0]?.title;

				return (
					<div key={item.id}>
						<GameCard.Item
							gameid={item.id}
							width={imagesData?.width ?? 200}
							height={imagesData?.height ?? 300}
							src={imagess}
							cSexualAvg={imagesData?.c_sexual_avg}
							title={displayTitle}
						/>
					</div>
				);
			})}
		</>
	);
};

export default SearchlistComponent;
