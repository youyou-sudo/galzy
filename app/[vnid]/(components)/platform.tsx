"use client";
import React from "react";
import { Avatar, Chip, Tooltip, Link } from "@heroui/react";

export default function Platform({ datas }) {
  const chopconfig = {
    size: "sm",
    target: "_blank",
    variant: "bordered",
  };
  return (
    <div className="mt-auto flex flex-wrap gap-2">
      <Tooltip
        content={
          <div className="px-1 py-2">
            <div className="text-small font-bold">VNDB</div>
          </div>
        }
      >
        <Chip
          {...chopconfig}
          classNames={{
            base: "border border-blue-900 text-slate-500",
            content: "opacity-70",
          }}
          as={Link}
          href={`https://vndb.org/${datas.vnid}`}
          avatar={<Avatar name="VNDB" src="https://vndb.org/favicon.ico" />}
        >
          {datas.vnid}
        </Chip>
      </Tooltip>
      {Array.from(new Set(datas.releases.map((regame) => regame.l_steam)))
        .filter(Boolean)
        .map((l_steam, index) => {
          const game = datas.releases.find(
            (regame) => regame.l_steam === l_steam
          );
          return (
            <Tooltip
              content={
                <div className="px-1 py-2">
                  <div className="text-small font-bold">Steam</div>
                  <div className="text-tiny">{game?.title}</div>
                </div>
              }
              key={index}
            >
              <Chip
                {...chopconfig}
                classNames={{
                  base: "border border-[#082f49] text-slate-500",
                  content: "opacity-70",
                }}
                as={Link}
                href={`https://store.steampowered.com/app/${l_steam}`}
                avatar={
                  <Avatar
                    name="Steam"
                    src="https://store.steampowered.com/favicon.ico"
                  />
                }
              >
                {l_steam}
              </Chip>
            </Tooltip>
          );
        })}
      {Array.from(new Set(datas.releases.map((regame) => regame.l_digiket)))
        .filter(Boolean)
        .map((l_digiket, index) => {
          const game = datas.releases.find(
            (regame) => regame.l_digiket === l_digiket
          );
          return (
            <Tooltip
              content={
                <div className="px-1 py-2">
                  <div className="text-small font-bold">Digiket</div>
                  <div className="text-tiny">{game?.title}</div>
                </div>
              }
              key={index}
            >
              <Chip
                {...chopconfig}
                classNames={{
                  base: "border border-[#0c4a6e] text-slate-500",
                  content: "opacity-70",
                }}
                as={Link}
                href={`https://www.digiket.com/work/show/_data/ID=ITM${l_digiket}`}
                avatar={
                  <Avatar
                    name="Digiket"
                    src="https://www.digiket.com/favicon.ico"
                  />
                }
              >
                {l_digiket}
              </Chip>
            </Tooltip>
          );
        })}
      {Array.from(new Set(datas.releases.map((regame) => regame.l_dlsite)))
        .filter(Boolean)
        .map((l_dlsite, index) => {
          const game = datas.releases.find(
            (regame) => regame.l_dlsite === l_dlsite
          );
          return (
            <Tooltip
              content={
                <div className="px-1 py-2">
                  <div className="text-small font-bold">Dlsite</div>
                  <div className="text-tiny">{game?.title}</div>
                </div>
              }
              key={index}
            >
              <Chip
                {...chopconfig}
                classNames={{
                  base: "border border-[#172554] text-slate-500",
                  content: "opacity-70",
                }}
                as={Link}
                href={`https://www.dlsite.com/pro/work/=/product_id/${l_dlsite}`}
                avatar={
                  <Avatar
                    name="Dlsite"
                    src="https://www.dlsite.com/images/web/common/favicon.ico"
                  />
                }
              >
                {l_dlsite}
              </Chip>
            </Tooltip>
          );
        })}
    </div>
  );
}
