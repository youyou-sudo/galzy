"use client";
import React from "react";
import * as motion from "motion/react-client";
import Image from "next/image";

export default function LoadingCard() {
  return (
    <motion.div
      className="flex flex-col"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-center">
        <Image
          unoptimized
          priority
          width={300}
          height={300}
          src="/loading.webp"
          alt="loading"
        />
      </div>
      <h1 className="text-center text-lg font-bold">Loading...</h1>
    </motion.div>
  );
}
