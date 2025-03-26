"use client";
import React from "react";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { useSidebarStore } from "@/store/sidebarStore";

export default function SidePanelSwitch() {
  const { setSidebarOpen } = useSidebarStore();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">打开菜单</span>
    </Button>
  );
}
