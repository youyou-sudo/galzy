"use server";
import { vndbmget, vndbidExists } from "@/lib/vndbdata";
import { alistListGet } from "@/app/[vnid]/(action)/alistGet";

export const getHomeModalData = async (vnid) => {
  function extractLinkedIds(releases) {
    return releases
      .flatMap((release) => [
        release.l_steam,
        release.l_egs,
        release.l_dlsite,
        release.l_digiket,
      ])
      .filter((value) => value !== undefined && value !== "" && value !== null);
  }

  const contentdatas = await vndbmget({ vnid });
  const l_iddata = extractLinkedIds(contentdatas.releases);
  l_iddata.push(vnid);
  const filedatas = await vndbidExists(l_iddata);
  const listtest = await alistListGet(filedatas);
  return {
    contentdatas: contentdatas,
    filedatas: filedatas,
    listtest: listtest,
  };
};
