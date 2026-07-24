import SearchlistComponent from "@web/components/home/search/meilisearch";
import SearchInput from "@web/components/home/search/Search";
import { GamepadIcon } from "lucide-react";

export default function SearchPage() {
	return (
		<section className="md:w-7xl p-3">
			<div className="flex items-center justify-center gap-2 mb-4">
				<GamepadIcon className="w-5 h-5 text-primary" />
				<h1 className="text-lg font-semibold text-foreground">游戏搜索</h1>
			</div>

			<div className="mx-auto md:w-1/2 items-center justify-center my-2">
				<SearchInput liveSearch />
			</div>

			<div className="grid grid-cols-3 gap-4 md:grid-cols-6">
				<SearchlistComponent />
			</div>
		</section>
	);
}
