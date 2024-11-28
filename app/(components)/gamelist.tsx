"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
  Image,
} from "@nextui-org/react";
import NextImage from "next/image";
import Link from "next/link";
import { ContentCard } from "@/app/[vnid]/(components)/ContentCard";
import Datalistview from "@/app/[vnid]/(components)/Datalistview";
import { env } from "next-runtime-env";
import * as motion from "motion/react-client";

export function Gamelsit({ datas }: { datas: any[] }) {
  const { isOpen, onClose, onOpen, onOpenChange } = useDisclosure();
  const [modalOpened, setModalOpened] = useState(false);
  const [manualClose, setManualClose] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!isOpen && modalOpened && !manualClose) {
      window.history.back();
      setModalOpened(false);
    }
  }, [isOpen, manualClose, modalOpened]);

  useEffect(() => {
    const handlePopState = () => {
      if (isOpen) {
        setManualClose(true);
        onClose();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const openModal = useCallback(
    (e: React.MouseEvent, gamelistdata: any) => {
      e.preventDefault();
      setModalData(gamelistdata);
      onOpen();
      setModalOpened(true);
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
    },
    [onOpen]
  );

  const renderGameList = useMemo(
    () =>
      datas.map((gamelistdata: any) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          key={gamelistdata.vnid}
        >
          <Card
            as={Link}
            onClick={!isMobile ? (e) => openModal(e, gamelistdata) : undefined}
            prefetch={true}
            href={`/${gamelistdata.vnid}`}
            isPressable={true}
            className="flex mt-2 w-full"
          >
            <CardBody className="flex p-3 flex-nowrap flex-row">
              <div className="relative shrink-0">
                <Image
                  width={100}
                  height={140}
                  isBlurred
                  isZoomed
                  as={NextImage}
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
      )),
    [datas, isMobile, openModal]
  );

  return (
    <>
      {renderGameList}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        scrollBehavior="inside"
        placement="center"
        size="4xl"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {modalData && (
                  <>
                    {
                      modalData.titles.find(
                        (item: { lang: any }) => item.lang === modalData.olang
                      )?.title
                    }
                  </>
                )}
              </ModalHeader>
              <ModalBody>
                {modalData && (
                  <div>
                    <ContentCard fullsereenfill={true} data={modalData} />
                    <Datalistview filedatas={modalData.filesiddatas} />
                  </div>
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
