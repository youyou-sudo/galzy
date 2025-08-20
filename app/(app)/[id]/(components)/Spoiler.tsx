"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative inline-block">
      {!revealed && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm rounded-lg z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 rounded-md border px-4 py-3">
              <TriangleAlert
                className="shrink-0 text-amber-500"
                size={16}
                aria-hidden="true"
              />
              <p className="text-sm">包含剧透内容</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setRevealed(true)}
              className="px-3 py-1 text-sm rounded-lg shadow"
            >
              我已了解
            </Button>
          </div>
        </div>
      )}
      <div
        className={`${
          revealed ? "" : "blur-md select-none"
        } flex flex-wrap gap-2`}
      >
        {children}
      </div>
    </div>
  );
}
