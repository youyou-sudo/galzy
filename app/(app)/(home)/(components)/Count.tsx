import React from "react";
import { totalCountGet } from "../(action)/homeData";
import { SlidingNumber } from "@/components/animate-ui/text/sliding-number";

export default async function CountComponent() {
  const coutn = await totalCountGet();
  return (
    <>
      {coutn && (
        <span className="pl-1 flex opacity-50">
          共收录了： <SlidingNumber number={coutn} padStart />
          条目
        </span>
      )}
    </>
  );
}
