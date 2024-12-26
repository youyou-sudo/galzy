import { Image, Card, CardBody } from "@nextui-org/react";
import Link from "next/link";
import { env } from "next-runtime-env";
import * as motion from "motion/react-client";

export function Gamelsit({ datas }: { datas: any[] }) {
  return (
    <>
      {datas.map((gamelistdata) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          key={gamelistdata.vnid}
        >
          <Card
            as={Link}
            isPressable
            href={`/${gamelistdata.vnid}`}
            className="flex mt-2 w-full"
          >
            <CardBody className="flex p-3 flex-nowrap flex-row">
              <div className="relative shrink-0">
                <Image
                  width={100}
                  height={140}
                  isBlurred
                  isZoomed
                  className="object-cover"
                  sizes="(max-width: 1200px) 100vw, (max-width: 768px) 50vw, 33vw"
                  src={`${env(
                    "NEXT_PUBLIC_VNDBIMG_URI"
                  )}/${gamelistdata.image.substring(
                    0,
                    2
                  )}/${gamelistdata.image.slice(-2)}/${gamelistdata.image.slice(
                    2
                  )}.jpg`}
                  alt="图片"
                />
              </div>
              <div className="ml-3 truncate">
                <p className="font-bold truncate">
                  {
                    gamelistdata.titles.find(
                      (item: { lang: any }) => item.lang === gamelistdata.olang
                    )?.title
                  }
                </p>
                <div className="italic opacity-70 text-sm truncate">
                  {gamelistdata.titles.find(
                    (item: { lang: any }) => item.lang === "zh-Hans"
                  )?.title ||
                    gamelistdata.titles.find(
                      (item: { official: any }) => item.official === "t"
                    )?.title ||
                    gamelistdata.titles.find(
                      (item: { lang: any }) => item.lang === "jp"
                    )?.title}
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </>
  );
}
