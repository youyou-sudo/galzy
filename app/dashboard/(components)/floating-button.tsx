"use client";

import type React from "react";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingButtonProps {
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function FloatingButton({
  icon = <Plus className="h-5 w-5" />,
  onClick,
  className,
  children,
}: FloatingButtonProps) {
  return (
    <Button
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 md:bottom-8 md:right-8 ${className}`}
      size="icon"
    >
      {icon}
      {children}
    </Button>
  );
}
