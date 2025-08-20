import { getImageUrl, imageAcc } from "@/lib/ImageUrl";
import { HoverPrefetchLink } from "../ui/hover-prefetch-link";
import { GameCard } from "../game-card";
import { homeData } from "@/app/(app)/(home)/(action)/homeData";

type HomeData = Awaited<ReturnType<typeof homeData>>;
type GameItemType = HomeData["items"][number];

// 小组件：单个游戏卡片
export const GameItem = ({ item }: { item: GameItemType }) => {
  let imagesData;
  if (item.other && item.other_datas?.other_media?.length) {
    imagesData =
      item.other_datas.other_media.find((m) => m.cover)?.media ?? item.images;
  } else {
    imagesData = item.images;
  }
  let imagess;
  if (!imagesData) {
    imagess = "";
  } else if ("hash" in imagesData) {
    imagess = imageAcc(imagesData.name);
  } else {
    imagess = getImageUrl({
      imageId: imagesData.id,
      width: imagesData.width,
      height: imagesData.height,
    });
  }

  let title;
  if (item.other_datas?.title?.length) {
    title = item.other_datas.title.find(
      (t) => t.lang === "zh-Hans" && t.title.trim() !== ""
    )?.title;
  }
  if (!title) {
    title = item.titles?.find(
      (t) => t.lang === item.olang && t.title.trim() !== ""
    )?.title;
  }

  return (
    <HoverPrefetchLink href={`/${item.id}`}>
      <div className="space-y-2 aspect-[2/3] p-0">
        <GameCard.Image
          sizes="(max-width: 768px) 100vw, 600px"
          fill
          priority={false}
          loading="lazy"
          src={imagess}
          alt={title || "图片"}
        />
      </div>
      <p className="text-sm truncate w-full text-center pl-2 pr-2 pt-2">
        {title}
      </p>
    </HoverPrefetchLink>
  );
};
