"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Pagination } from "@nextui-org/react";
// total 为总页数，pages 为当前页码
export function Pag({ pages, total }) {
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const handleClick = (pages) => {
    const params = new URLSearchParams(searchParams);
    if (pages && pages == 1) {
      params.delete("pages");
    } else {
      params.set("pages", pages);
    }
    replace(`?${params.toString()}`);
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
          onChange={(page) => handleClick(page)}
        />
      </div>
    </>
  );
}
