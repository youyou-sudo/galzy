import { Await, getRouteApi, Link } from "@tanstack/react-router";
import { Skeleton } from "../ui/skeleton";

interface Item {
	id?: string;
	tag?: string;
	title: string;
}

interface RankingListProps {
	datas: Item[] | null;
	linkKey: "id" | "tag";
}

function Comp({ datas, linkKey }: RankingListProps) {
	return (
		<ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
			{datas?.map((item, index) => {
				const linkValue = item[linkKey];
				if (!linkValue) return null;
				const href = linkKey === "tag" ? `/tags/${linkValue}` : `/${linkValue}`;

				return (
					<li key={linkValue} className="w-full">
						<Link to={href} className="block w-full">
							<span className="flex items-center w-full">
								<span
									className={`font-bold mr-2 shrink-0 ${
										index === 0
											? "text-red-500"
											: index === 1
												? "text-yellow-500"
												: index === 2
													? "text-blue-500"
													: ""
									}`}
								>
									{index + 1}.
								</span>
								<span
									className={`font-bold text-sm flex-1 min-w-0 truncate ${
										index === 0
											? "underline decoration-red-500 underline-offset-4"
											: index === 1
												? "underline decoration-yellow-500 underline-offset-4"
												: index === 2
													? "underline decoration-blue-500 underline-offset-4"
													: ""
									}`}
								>
									{linkKey === "tag" ? "#" : ""}
									{item.title}
								</span>
							</span>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

const apiroute = getRouteApi("/");

export const RankingList = ({ linkKey }: { linkKey: "id" | "tag" }) => {
	const { rankings } = apiroute.useLoaderData();
	return (
		<Await promise={rankings} fallback={<SkeletonList />}>
			{(data) => {
				return (
					<Comp
						datas={linkKey === "tag" ? data.tag : data.game}
						linkKey={linkKey}
					/>
				);
			}}
		</Await>
	);
};

const SkeletonList = ({ count = 4 }: { count?: number }) => (
	<>
		{Array.from({ length: count }).map((_, index) => (
			<Skeleton key={index} className="h-5.25 w-full my-2.5" />
		))}
	</>
);
