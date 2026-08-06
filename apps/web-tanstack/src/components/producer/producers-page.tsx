import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Input } from "@web/components/ui/input";
import {
	Building2Icon,
	ChevronLeft,
	ChevronRight,
	SearchIcon,
	XIcon,
} from "lucide-react";
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
			const trimmed = value.trim();
			navigate({
				to: "/producer",
				search: trimmed ? { q: trimmed } : {},
				replace: true,
			});
		},
		[navigate],
	);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			handleSearch(value);
		}, 300);
	};

	const handleClear = () => {
		setInputValue("");
		navigate({ to: "/producer", search: {}, replace: true });
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
			handleSearch(inputValue);
		}
	};

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const handlePageChange = (p: number) => {
		navigate({
			to: "/producer",
			search: { q: initialQ, page: p },
		});
	};

	const producerItems = producers?.hits ?? [];
	const totalPages = producers?.totalPages ?? 0;

	return (
		<section className="md:w-7xl p-3 space-y-4">
			<div className="flex items-center justify-center gap-2 mb-4">
				<Building2Icon className="w-5 h-5 text-primary" />
				<h1 className="text-lg font-semibold text-foreground">厂商检索</h1>
			</div>

			<div className="mx-auto md:w-1/2 items-center justify-center my-2">
				<div className="relative">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						placeholder="输入厂商名称搜索，回车或自动搜索喵～"
						className="pl-9 pr-8"
					/>
					{inputValue && (
						<button
							type="button"
							onClick={handleClear}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
							aria-label="清除搜索"
						>
							<XIcon className="size-4" />
						</button>
					)}
				</div>
			</div>

			{producers && (
				<p className="text-center text-sm text-muted-foreground">
					共 {producers.totalHits} 个厂商
				</p>
			)}

			{producerItems.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
					<Building2Icon className="size-12 mb-4 opacity-30" />
					<p className="text-lg">没有找到匹配的厂商喵～</p>
					<p className="text-sm mt-1">试试其他关键词吧 🐾</p>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{producerItems.map((producer) => (
						<Link
							key={producer.id}
							to="/producer/$pid"
							params={{ pid: producer.id }}
							className="no-underline"
						>
							<Card className="h-full transition-colors hover:bg-secondary/40">
								<CardHeader>
									<CardTitle className="text-base">{producer.name}</CardTitle>
								</CardHeader>
								{(producer.latin || producer.original || producer.alias) && (
									<CardContent className="pt-0 text-sm text-muted-foreground line-clamp-2">
										{producer.latin || producer.original || producer.alias}
									</CardContent>
								)}
							</Card>
						</Link>
					))}
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2 pt-10">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => handlePageChange(page - 1)}
					>
						<ChevronLeft className="size-4" />
						上一页
					</Button>

					<div className="flex items-center gap-1">
						{paginationRange(page, totalPages).map((p, i) =>
							p === "…" ? (
								<span
									key={`dots-${i}`}
									className="px-1 text-muted-foreground text-sm"
								>
									…
								</span>
							) : (
								<Button
									key={p}
									variant={p === page ? "default" : "outline"}
									size="sm"
									className="min-w-9 px-2"
									onClick={() => handlePageChange(p)}
								>
									{p}
								</Button>
							),
						)}
					</div>

					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onClick={() => handlePageChange(page + 1)}
					>
						下一页
						<ChevronRight className="size-4" />
					</Button>
				</div>
			)}
		</section>
	);
}

/** Generate a compact page range: [1, …, 4, 5, 6, …, 10] */
function paginationRange(current: number, total: number): (number | "…")[] {
	if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

	if (current <= 3) return [1, 2, 3, 4, "…", total];
	if (current >= total - 2)
		return [1, "…", total - 3, total - 2, total - 1, total];
	return [1, "…", current - 1, current, current + 1, "…", total];
}
