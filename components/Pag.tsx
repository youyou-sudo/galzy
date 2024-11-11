"use client";
import { Pagination } from "@nextui-org/react";
import { useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
// total 为总页数，pages 为当前页码
export function Pag({ pages, total }: { pages: number; total: number }) {
  const [pagess, setPagess] = useQueryState("pages", { defaultValue: "" });
  const router = useRouter();

  const handleClick = async (onpage: number) => {
    if (onpage !== 1) {
      await setPagess(String(onpage));
    } else {
      await setPagess(null);
    }
    router.refresh();
  };

  return (
    <>
      <div className="flex w-full justify-center mt-3">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          initialPage={pages === 0 ? 1 : pages}
          total={total === 0 ? 1 : total}
          onChange={(onpage) => handleClick(onpage)}
        />
      </div>
    </>
  );
}
