import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface SearchInputProps {
  placeholder?: string;
}

export default function SearchInput({
  placeholder = "标题、标签、回车，喵喵喵～🐾",
}: SearchInputProps) {
  const navigate = useNavigate();

  const [inputValue, setInputValue] = useState("");

  // 同步 URL → input
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInputValue(params.get("q") ?? "");
  }, []);

  const handleSearch = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // 避免重复跳转
    const params = new URLSearchParams(window.location.search);
    if (trimmed === params.get("q")) return;

    navigate({
      to: "/search",
      search: { q: trimmed },
      replace: true, // 防止 history 堆积
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <Card className="p-0 border-0 shadow-none w-full">
      <div className="relative">
        <Input
          className="peer ps-9 pe-9"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />

        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 inset-s-0 flex items-center justify-center ps-3">
          <SearchIcon size={16} aria-hidden="true" />
        </div>

        <Button
          onClick={handleSearch}
          variant="ghost"
          disabled={!inputValue.trim()}
          size="sm"
          className="absolute inset-y-0 inset-e-0 mr-2 flex h-full w-12 items-center justify-center"
          type="button"
        >
          搜索
        </Button>
      </div>
    </Card>
  );
}
