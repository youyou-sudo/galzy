import Link from "next/link";

interface Item {
  id?: string;
  tag?: string;
  title: string;
}

interface RankingListProps {
  fetchData: () => Promise<Item[]>;
  linkKey: "id" | "tag"; // 链接使用哪个字段
}

export default async function RankingList({
  fetchData,
  linkKey,
}: RankingListProps) {
  const datas = await fetchData();

  return (
    <ul
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 truncate 
             max-h-[8.5rem] overflow-y-auto"
    >
      {datas.map((item, index) => {
        const linkValue = item[linkKey];
        const href =
          linkKey === "tag" ? `/tags/${linkValue}` : `/${linkValue}`;

        return (
          <li key={linkValue} className="truncate">
            <Link href={href}>
              <span className="text-ellipsis overflow-hidden">
                <span
                  className={`font-bold mr-2 ${
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
                  className={`font-bold mr-2 ${
                    index === 0
                      ? "underline decoration-red-500 underline-offset-4"
                      : index === 1
                      ? "underline decoration-yellow-500 underline-offset-4"
                      : index === 2
                      ? "underline decoration-blue-500 underline-offset-4"
                      : ""
                  }`}
                >
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
