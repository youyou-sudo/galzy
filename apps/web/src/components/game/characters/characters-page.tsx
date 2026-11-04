import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { CharacterDialog } from "./character-dialog";
import { CharacterList } from "./character-list";
import { characterInfoQueryOptions } from "./character-queries";
import {
	type CharacterView,
	readCharacterList,
	toCharacterInfoView,
} from "./character-types";

/**
 * 「详情」页签容器：名册来自 route loader（SSR 首屏就有），
 * 角色资料在打开弹窗时按需拉取（见 character-queries.ts）。
 *
 * 关闭弹窗后保留 selected：「退场动画的 100ms 里内容不能突然变空」，
 * 同时焦点也能正常还给被点的卡片。
 */
export function CharactersPage({ data }: { data: unknown }) {
	const characters = useMemo(() => readCharacterList(data), [data]);
	const [selected, setSelected] = useState<CharacterView | null>(null);
	const [open, setOpen] = useState(false);

	const detail = useQuery({
		...characterInfoQueryOptions(selected?.id ?? ""),
		enabled: open && Boolean(selected?.id),
	});

	const handleSelect = useCallback((character: CharacterView) => {
		setSelected(character);
		setOpen(true);
	}, []);

	const handleOpenChange = useCallback((next: boolean) => {
		setOpen(next);
	}, []);

	const handleRetry = useCallback(() => {
		void detail.refetch();
	}, [detail]);

	const info = useMemo(
		() => (detail.data ? toCharacterInfoView(detail.data) : null),
		[detail.data],
	);

	return (
		<>
			<CharacterList characters={characters} onSelect={handleSelect} />
			<CharacterDialog
				character={selected}
				info={info}
				isDetailError={detail.isError && !detail.isFetching}
				isDetailLoading={
					detail.isPending || (detail.isFetching && detail.data === undefined)
				}
				onOpenChange={handleOpenChange}
				onRetry={handleRetry}
				open={open}
			/>
		</>
	);
}
