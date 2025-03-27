import React from "react";
import * as motion from "motion/react-client";

export default function MontionWhileHover({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <motion.div
        whileHover={{
          scale: 1.01,
          transition: { duration: 0.2 },
        }}
        className="h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
