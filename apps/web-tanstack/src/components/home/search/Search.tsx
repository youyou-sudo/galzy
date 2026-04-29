import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface SearchInputProps {
  placeholder?: string;
}

export default function SearchInput({
  placeholder = "标题、标签、回车，喵喵喵～🐾",
}: SearchInputProps) {
  const navigate = useNavigate();

  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);

  // 同步 URL → input
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInputValue(params.get("q") ?? "");
    setStartDate(params.get("start") ?? "");
    setEndDate(params.get("end") ?? "");
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    const trimmed = inputValue.trim();
    if (!trimmed && !startDate && !endDate) return;

    navigate({
      to: "/search",
      search: {
        q: trimmed || undefined,
        start: startDate || undefined,
        end: endDate || undefined,
      },
      replace: true,
    });

    setIsOpen(false);
  };

  return (
    <Card
      ref={wrapperRef}
      className="p-0 border-0 shadow-none w-full relative"
    >
      <div className="relative">
        <Input
          className="peer ps-9 pe-9"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder={placeholder}
        />

        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 inset-s-0 flex items-center justify-center ps-3">
          <SearchIcon size={16} />
        </div>

        <Button
          onClick={handleSearch}
          variant="ghost"
          disabled={!inputValue.trim() && !startDate && !endDate}
          size="sm"
          className="absolute inset-y-0 inset-e-0 mr-2 flex h-full w-12 items-center justify-center"
          type="button"
        >
          搜索
        </Button>
      </div>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 p-4 bg-background border rounded-lg shadow-md z-50">
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">~</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleSearch}>
              应用筛选
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
