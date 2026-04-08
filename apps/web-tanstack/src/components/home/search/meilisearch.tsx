/** biome-ignore-all lint/suspicious/noExplicitAny: <any> */
import { getRouteApi } from "@tanstack/react-router";
import { TagViewsTrackEvents } from "#/components/umami/track-events";
import { getImageUrl } from "#/lib/ImageUrl";
import { GameItem } from "../GameItem";

const routeApi = getRouteApi("/search/");

const SearchlistComponent = () => {
  const { searchdata } = routeApi.useLoaderData();
  const gameList = () => {
    return searchdata?.hits.map((item) => {
      const imageFilter = () => {
        const images =
          item.other &&
            item.other_datas?.other_media.some((item: any) => item.cover === true)
            ? item.other_datas.other_media.find(
              (item: any) => item.cover === true,
            )?.media
            : item.images;
        return images;
      };
      const imagesData = imageFilter();
      let imagess = "/No-Image-Placeholder.svg.webp";

      if (imagesData) {
        if (imagesData.id && imagesData.width && imagesData.height) {
          imagess = getImageUrl({
            imageId: imagesData.id,
            width: imagesData.width,
            height: imagesData.height,
          });
        }
      }
      return (
        <div key={item.id}>
          {/* [x] VNDB 来源图片进行缓存以防止滥用 VNDB 服务
					 */}
          <GameItem
            gameid={item.id}
            width={imagesData?.width ?? 200}
            height={imagesData?.height ?? 300}
            src={imagess}
            title={
              item.other_datas?.title?.length
                ? (item.other_datas.title.find(
                  (it: { lang: string }) => it.lang === "zh-Hans",
                )?.title ?? item.other_datas.title[0]?.title)
                : item.titles.find(
                  (it: { lang: string }) => it.lang === item.olang,
                )?.title
            }
          />
        </div>
      );
    });
  };
  const tagtitle = `[tag:${searchdata?.topTag?.id}]-[${searchdata?.topTag?.zh_name}]`;
  if ((searchdata?.hits ?? []).length === 0) {
    return (
      <div className="flex text-center font-bold justify-center items-center">
        喵~没有找到哦 🐾，可以尝试其他关键字喵～💕
      </div>
    );
  }
  return (
    <>
      {gameList()}
      {searchdata?.topTag && <TagViewsTrackEvents tagtitle={tagtitle} />}
    </>
  );
};

export default SearchlistComponent;
