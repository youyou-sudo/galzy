"use server";
import { vndbmget } from "@/lib/vndbdata";

export const getHomeModalData = async (vnid) => {
  const contentdatas = await vndbmget({ vnid });
  return {
    contentdatas: contentdatas,
  };
};
