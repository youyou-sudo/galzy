"use client";
import React from "react";
import { motion } from "framer-motion";

export default function Handmotion({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
