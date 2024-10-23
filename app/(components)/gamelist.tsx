"use client";

import {
  Card,
  CardBody,
  Image,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
  Link,
} from "@nextui-org/react";
import { ContentCard } from "../[vnid]/(components)/ContentCard";
import Datalistview from "../[vnid]/(components)/Datalistview";
import { getHomeModalData } from "@/lib/actions/HomeModaldata";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function Gamelsit({ datas }: { datas: any }) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [modalOpened, setModalOpened] = useState(false); // 标志
  const [manualClose, setManualClose] = useState(false); // 是否是手动关闭
  const [modadldata, setModadldata] = useState();
  const [modalData, setModalData] = useState();
  // 监听 Modal 状态变化
  useEffect(() => {
    if (!isOpen && modalOpened && !manualClose) {
      window.history.back();
      setModalOpened(false); // 重置标志
    }
  }, [isOpen, modalOpened]);

  // 监听浏览器的返回事件，用户点击返回时关闭 Modal
  useEffect(() => {
    const handlePopState = () => {
      if (isOpen) {
        setManualClose(true); // 标记为手动关闭，避免二次返回
        onOpenChange(false); // 用户点击浏览器返回按钮时关闭 Modal
      }
    };

    window.addEventListener("popstate", handlePopState); // 监听 popstate 事件

    return () => {
      window.removeEventListener("popstate", handlePopState); // 清理监听器
    };
  }, [isOpen, onOpenChange]);

  // 判断是否为手机端，如果为手机端，则进行 /VNID
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768); // 判断手机端，768px 是标准的断点
    };

    handleResize(); // 初次加载时判断一次
    window.addEventListener("resize", handleResize); // 监听窗口大小变化

    return () => {
      window.removeEventListener("resize", handleResize); // 清理监听器
    };
  }, []);

  // 开启 Modal 查看
  const openModal = async (e, gamelistdata: any) => {
    e.preventDefault(); // 阻止默认的跳转行为
    setModalData(gamelistdata);
    onOpenChange(true); // 打开 modal
    setModalOpened(true); // 设置 Modal 打开标志
    const title =
      gamelistdata.vnid &&
      gamelistdata.titles.find(
        (item: { lang: string }) => item.lang === gamelistdata.olang
      )?.title;

    const finalTitle = title ? title : undefined;

    window.history.pushState(
      { title: finalTitle, vnid: gamelistdata.vnid },
      title,
      `/${gamelistdata.vnid}`
    );
    const log: any = await getHomeModalData(gamelistdata.vnid); // 获取数据
    setModadldata(log); // 设置 modal 数据
  };

  return (
    <>
      {datas.data.map((gamelistdata, index) => (
        <div key={gamelistdata.vnid}>
          <motion.div
            className="box"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.02,
              duration: 0.3,
            }}
          >
            <Card
              as={Link}
              onClick={
                !isMobile ? (e) => openModal(e, gamelistdata) : undefined
              }
              href={`/${gamelistdata.vnid}`}
              isPressable={!isMobile} // 仅在桌面端可按压
              className="flex mt-2 w-full"
              key={gamelistdata.vnid}
            >
              <CardBody className="flex p-3 flex-nowrap flex-row">
                <div className="w-[100px] shrink-0">
                  <Image
                    isBlurred
                    isZoomed
                    shadow="sm"
                    radius="lg"
                    width={100}
                    className="object-cover h-[140px]"
                    src={
                      gamelistdata.image
                        ? `${
                            process.env.NEXT_PUBLIC_VNDBIMG_URI
                          }/${gamelistdata.image.substring(
                            0,
                            2
                          )}/${gamelistdata.image.slice(-2)}/${gamelistdata.image.slice(
                            2
                          )}.jpg`
                        : "https://dummyimage.com/679x481/9e9e9e/fff"
                    }
                    fallbackSrc="https://dummyimage.com/679x481/9e9e9e/fff"
                    alt="图片"
                  />
                </div>
                <div className="ml-3 truncate">
                  <p className="font-bold truncate">
                    {
                      gamelistdata.titles.find(
                        (item: { lang: any }) =>
                          item.lang === gamelistdata.olang
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
        </div>
      ))}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        scrollBehavior="inside"
        placement="center"
        size="4xl"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {
                  modalData.titles.find(
                    (item: { lang: any }) => item.lang === modalData.olang
                  )?.title
                }
              </ModalHeader>
              <ModalBody>
                <div>
                  <ContentCard fullsereenfill={true} data={modalData} />
                  <Datalistview
                    filedatas={modadldata?.filedatas}
                    dlink={modadldata?.listtest.dlink}
                  />
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
