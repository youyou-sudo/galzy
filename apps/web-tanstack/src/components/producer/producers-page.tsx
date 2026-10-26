import { Link, useNavigate } from "@tanstack/react-router";
import { EmptyState } from "@web/components/shared/empty-state";
import { PageHeader } from "@web/components/shared/page-header";
import { Pagination } from "@web/components/shared/pagination";
import { SearchField } from "@web/components/shared/search-field";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Building2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ProducerHit {
	id: string;
	name: string | null;
	latin: string | null;
	original: string | null;
	alias: string | null;
	type: string | null;
	lang: string | null;
	description: string | null;
}

interface ProducersResult {
	hits: ProducerHit[];
	totalHits: number;
	totalPages: number;
	page: number;
	hitsPerPage: number;
}

/**
 * 厂商检索页：页头/搜索/列表/分页全部走 shared 原语，
 * 只在本地保留「输入防抖 → URL search 同步」这条原有逻辑。
 */
export default function ProducersPage({
	producers,
	q: initialQ,
	page,
}: {
	producers: ProducersResult | null | undefined;
	q: string | undefined;
	page: number;
}) {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState(initialQ || "");
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

	const handleSearch = useCallback(
		(value: string) => {
			// 回车提交时取消尚未触发的防抖导航，避免同值导航跑两次
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
			const trimmed = value.trim();
			navigate({
				to: "/producer",
				search: trimmed ? { q: trimmed } : {},
				replace: true,
			});
		},
		[navigate],
	);

	const handleInputChange = (value: string) => {
		setInputValue(value);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			handleSearch(value);
		}, 300);
	};

	const handleClear = () => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		setInputValue("");
		navigate({ to: "/producer", search: {}, replace: true });
	};

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const producerItems = producers?.hits ?? [];
	const totalPages = producers?.totalPages ?? 0;

	return (
		<section>
			<PageHeader
				icon={Building2Icon}
				title="厂商检索"
				description="按厂商 / 开发会社浏览收录的作品"
				meta={
					producers ? `共 ${producers.totalHits} 个厂商` : undefined
				}
			/>

			<div className="mb-4 w-full sm:max-w-md">
				<SearchField
					value={inputValue}
					onChange={handleInputChange}
					onSubmit={handleSearch}
					onClear={handleClear}
					placeholder="输入厂商名称搜索，回车或自动搜索喵～"
					ariaLabel="搜索厂商"
				/>
			</div>

			{producerItems.length === 0 ? (
				<EmptyState
					icon={Building2Icon}
					title={initialQ ? "没有找到匹配的厂商" : "暂无厂商数据"}
					description={
						initialQ
							? "试试其他关键词，或清空搜索查看全部厂商"
							: "厂商数据正在同步，稍后再来看看吧"
					}
					action={
						initialQ ? (
							<Button variant="outline" size="sm" onClick={handleClear}>
								清空搜索
							</Button>
						) : undefined
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{producerItems.map((producer) => (
						<Link
							key={producer.id}
							to="/producer/$pid"
							params={{ pid: producer.id }}
							className="group rounded-2xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
						>
							<Card className="h-full transition-colors duration-200 group-hover:bg-muted/40 group-hover:ring-border">
								<CardHeader>
									<CardTitle className="text-base">{producer.name}</CardTitle>
								</CardHeader>
								{(producer.latin || producer.original || producer.alias) && (
									<CardContent className="line-clamp-2 pt-0 text-sm text-muted-foreground">
										{producer.latin || producer.original || producer.alias}
									</CardContent>
								)}
							</Card>
						</Link>
					))}
				</div>
			)}

			<Pagination
				page={page}
				totalPages={totalPages}
				renderLink={(nextPage) => (
					<Link to="/producer" search={{ q: initialQ, page: nextPage }} />
				)}
			/>
		</section>
	);
}
