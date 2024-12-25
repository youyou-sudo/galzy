"use client";

import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Link,
  Divider,
  Image,
  Skeleton,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  Chip,
  Tooltip,
} from "@nextui-org/react";
import { Gamepad, PersonalComputer, Risk, Android } from "grommet-icons";
import { useEffect, useState } from "react";
import { alistListGet } from "../(action)/alistGet";
import * as motion from "motion/react-client";
import { MdOutlinePageview } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Path color map to render corresponding icons and labels
const pathColorMap = {
  PC: (
    <>
      <PersonalComputer />
      PC
    </>
  ),
  PSP: (
    <>
      <Gamepad />
      PSP
    </>
  ),
  TY: (
    <>
      <Image src="/tyranor.webp" width={25} alt="tyranor" loading="lazy" />
      Tyranor
    </>
  ),
  KR: (
    <>
      <Image src="/Kkirikiri.webp" width={25} alt="Kkirikiri" loading="lazy" />
      Kkirikiri
    </>
  ),
  双端: (
    <>
      <Risk />
      双端
    </>
  ),
  APK: (
    <>
      <Android />
      APK 安装
    </>
  ),
  ONS: (
    <>
      <Image
        src="/ONScripter.webp"
        width={25}
        alt="ONScripter"
        loading="lazy"
      />
      ONScripter
    </>
  ),
};

const pathColorMap2 = {
  unk: false,
  win: "Windows",
  lin: "Linux",
  mac: "Mac OS",
  web: "Website",
  tdo: "3DO",
  ios: "Apple iProduct",
  and: "Android",
  bdp: "Blu-ray Player",
  dos: "DOS",
  dvd: "DVD Player",
  drc: "Dreamcast",
  nes: "Famicom",
  sfc: "Super Famicom",
  fm7: "FM-7",
  fm8: "FM-8",
  fmt: "FM Towns",
  gba: "Game Boy Advance",
  gbc: "Game Boy Color",
  msx: "MSX",
  nds: "Nintendo DS",
  swi: "Nintendo Switch",
  wii: "Nintendo Wii",
  wiu: "Nintendo Wii U",
  n3d: "Nintendo 3DS",
  p88: "PC-88",
  p98: "PC-98",
  pce: "PC Engine",
  pcf: "PC-FX",
  psp: "PlayStation Portable",
  ps1: "PlayStation 1",
  ps2: "PlayStation 2",
  ps3: "PlayStation 3",
  ps4: "PlayStation 4",
  ps5: "PlayStation 5",
  psv: "PlayStation Vita",
  smd: "Sega Mega Drive",
  scd: "Sega Mega-CD",
  sat: "Sega Saturn",
  vnd: "VNDS",
  x1s: "Sharp X1",
  x68: "Sharp X68000",
  xb1: "Xbox",
  xb3: "Xbox 360",
  xbo: "Xbox One",
  xxs: "Xbox X/S",
  mob: "mobile",
  oth: false,
};

function Modalfun({
  isOpen,
  onOpenChange,
  data,
  dlink,
  gfpath,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: any;
  dlink?: string;
  gfpath: string;
}) {
  if (!data) return null;

  // Size 转换
  function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return "0 字节";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["字节", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
      <ModalContent>
        <>
          <ModalHeader className="flex flex-col gap-1">文件详情</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-2">
              <p className="text-center text-lg">{data.name}</p>
              <p className="text-center">{formatBytes(Number(data.size))}</p>
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-center gap-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
            <Button asChild>
              <Link
                target="_blank"
                href={`${dlink}/${gfpath}/${data.pathname}?sign=${data.sign}`}
              >
                下载
              </Link>
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  );
}

// 文件列递归组件
const FileMap = ({
  filelist,
  level = 0,
  pathtmp,
  dlink,
  gfpath,
}: {
  filelist: any[];
  level?: number;
  pathtmp?: string;
  dlink?: string;
  gfpath: string;
}) => {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  if (!filelist || filelist.length === 0) return null;

  const handleFileClick = (file: any) => {
    setSelectedFile(file);
    onOpen();
  };

  return (
    <>
      <motion.div
        className="flex flex-col"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ul style={{ marginLeft: `${level > 0 ? 25 : 0}px` }}>
          {filelist.map((item, index) => (
            <motion.div
              key={index}
              className="flex flex-col"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.02,
                duration: 0.1,
              }}
            >
              <li>
                {item.is_dir === true ? (
                  <>
                    {pathColorMap[item.name as keyof typeof pathColorMap] ? (
                      <>
                        <div className="flex text-2xl font-extrabold gap-1 items-center">
                          {pathColorMap[item.name as keyof typeof pathColorMap]}
                        </div>
                        <Separator className="my-2" />
                      </>
                    ) : (
                      <>
                        <p>{item.name}</p>
                        <Divider />
                      </>
                    )}
                    <FileMap
                      filelist={item.filelist}
                      level={level + 1}
                      pathtmp={pathtmp || "" + "/" + item.name}
                      dlink={dlink}
                      gfpath={gfpath}
                    />
                  </>
                ) : (
                  <>
                    <div className="list-disc flex">
                      <Button
                        variant="link"
                        onClick={() => {
                          handleFileClick(item);
                        }}
                        className="block truncate"
                      >
                        {item.name}
                        <span className="inline-flex items-center">
                          <MdOutlinePageview />
                        </span>
                      </Button>
                    </div>
                  </>
                )}
              </li>
            </motion.div>
          ))}
        </ul>
      </motion.div>

      <Modalfun
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        data={selectedFile}
        dlink={dlink}
        gfpath={gfpath}
      />
    </>
  );
};

// 组件
export function Stview({ filedatas }: { filedatas: any }) {
  const [listtest, setListtest] = useState();
  useEffect(() => {
    const listac = async () => {
      if (filedatas) {
        const listtest = await alistListGet(filedatas);
        setListtest(listtest);
      }
    };
    listac();
  }, [filedatas]);
  return (
    <>
      <motion.div
        className="flex flex-col"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {listtest ? (
          <FileMap
            filelist={listtest.data}
            gfpath={filedatas.path}
            dlink={listtest.dlink}
          />
        ) : (
          <div className="w-full flex flex-col gap-2 mt-3">
            <Skeleton className="h-7 w-1/5 rounded-lg" />
            <Skeleton className="h-6 w-3/5 rounded-lg" />
          </div>
        )}
      </motion.div>
    </>
  );
}

// VNDB 图片数据接口 type
interface Screenshot {
  thumbnail: string;
  url: string;
  release: {
    id: string;
    title: string;
    platforms: string[];
    languages: { lang: string }[];
  };
}

interface Result {
  id: string;
  screenshots: Screenshot[];
}

interface Data {
  more: boolean;
  results: Result[];
}

export default function Datalistview({
  filedatas,
  vid,
}: {
  filedatas: any;
  vid: string;
}) {
  const [vndbImagesData, setVndbImagesData] = useState<any>([]);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [dltap, setDltap] = useState(false);
  const [imagemodal, setImagemodal] = useState({
    turl: "",
    url: "",
    urlLoaded: false,
  });
  useEffect(() => {
    if (isOpen === false) {
      setImagemodal({
        turl: "",
        url: "",
        urlLoaded: false,
      });
    }
  }, [isOpen]);
  useEffect(() => {
    (async () => {
      const raw = JSON.stringify({
        filters: ["id", "=", `${vid}`],
        fields:
          "id,screenshots.release.title,screenshots.release.id,screenshots.url,screenshots.thumbnail,screenshots.release.languages.lang,screenshots.release.platforms",
      });
      const response = await fetch(`https://api.vndb.org/kana/vn`, {
        method: `POST`,
        headers: {
          "Content-Type": "application/json",
          Host: "api.vndb.org",
        },
        body: raw,
        next: {
          revalidate: 21600,
        },
      });
      const datas = await response.json();
      // 重新组织 VNDB 获取的图片数据
      function groupByReleaseId(data: Data): Record<string, Screenshot[]> {
        const grouped: Record<string, Screenshot[]> = {};

        data.results.forEach((result) => {
          result.screenshots.forEach((screenshot) => {
            const releaseId = screenshot.release.id;

            if (!grouped[releaseId]) {
              grouped[releaseId] = [];
            }

            grouped[releaseId].push(screenshot);
          });
        });

        return grouped;
      }
      const groupedData = groupByReleaseId(datas);
      setVndbImagesData(groupedData);
      setDltap(true);
    })();
  }, [vid]);
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ damping: 1 }}
      >
        <Tabs aria-label="Options" className="mt-3" variant="light">
          <Tab key="download" title="下载">
            <Card>
              <CardBody>
                {filedatas.map((item: any, index: any) => (
                  <Stview key={index} filedatas={item} />
                ))}
              </CardBody>
            </Card>
          </Tab>
          <>
            <Tab key="phtot" title="图片">
              <Card>
                <CardBody>
                  <div>
                    {dltap ? (
                      <>
                        {Object.keys(vndbImagesData).map((rid) => {
                          const release = vndbImagesData[rid];
                          const firstItem = release[0]; // 获取当前 releaseId 下的第一项
                          console.log(firstItem);
                          const { title, platforms, languages } =
                            firstItem.release;
                          return (
                            <div key={rid}>
                              <h2 className="flex items-center gap-1 justify-center">
                                {languages.map((languages, index: any) => (
                                  <Image
                                    isBlurred
                                    radius="none"
                                    key={index}
                                    width={20}
                                    alt={languages}
                                    src={`/lang/${languages.lang}.png`}
                                  ></Image>
                                ))}
                                {platforms.map((platform, index: any) => (
                                  <Tooltip
                                    content={`${pathColorMap2[platform]}`}
                                    key={index}
                                  >
                                    <Image
                                      isBlurred
                                      radius="none"
                                      key={index}
                                      width={20}
                                      alt={pathColorMap2[platform]}
                                      src={`/plat/${platform}.svg`}
                                    ></Image>
                                  </Tooltip>
                                ))}
                                {title}
                              </h2>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {vndbImagesData[rid].map(
                                  (screenshot: Screenshot, index: any) => (
                                    <Card
                                      key={index}
                                      isPressable
                                      shadow="sm"
                                      className="m-2 inline-flex"
                                      onPress={() => {
                                        setImagemodal({
                                          turl: screenshot.thumbnail,
                                          url: screenshot.url,
                                          urlLoaded: false,
                                        });
                                        onOpen();
                                      }}
                                    >
                                      <CardBody className="p-0 inline-block">
                                        <Image
                                          alt="screenshot"
                                          className="w-full h-auto"
                                          width={200}
                                          src={screenshot.thumbnail}
                                        />
                                      </CardBody>
                                    </Card>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <Spinner size="sm" color="default" />
                    )}
                  </div>
                </CardBody>
              </Card>
            </Tab>
          </>
        </Tabs>
      </motion.div>
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="3xl"
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalBody
                className="flex flex-col p-0"
                onClick={() => onClose()}
              >
                <img
                  src={imagemodal.url}
                  alt="高清图片浏览中，如要关闭请点击空白处"
                  className="w-full h-auto"
                  style={{ display: imagemodal.urlLoaded ? "block" : "none" }}
                  onLoad={() =>
                    setImagemodal((prev) => ({ ...prev, urlLoaded: true }))
                  }
                />
                {!imagemodal.urlLoaded && (
                  <img
                    src={imagemodal.turl}
                    alt="加载中"
                    className="w-full h-auto blur-sm"
                  />
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
