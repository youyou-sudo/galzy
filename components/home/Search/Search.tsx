"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "@bprogress/next/app";
import { useQueryState } from "nuqs";
import { Search, Sparkles } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  className?: string;
  placeholder?: string;
}

export default function SearchInput({
  className,
  placeholder = "搜索...",
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isOnSearchPage = pathname === "/search";

  // 使用 nuqs 管理查询参数
  const [query, setQuery] = useQueryState("q", {
    defaultValue: "",
    shallow: false,
  });
  const [aiEnabled, setAiEnabled] = useQueryState("ai", {
    defaultValue: "false",
    shallow: false,
  });

  // 本地状态用于输入框
  const [inputValue, setInputValue] = useState(query || "");
  const [isAiOn, setIsAiOn] = useState(aiEnabled === "true");

  // 同步路由状态到本地状态
  useEffect(() => {
    setInputValue(query || "");
  }, [query]);

  useEffect(() => {
    setIsAiOn(aiEnabled === "true");
  }, [aiEnabled]);

  // 处理搜索提交
  const handleSearch = () => {
    if (!inputValue.trim()) return;

    if (isOnSearchPage) {
      // 在搜索页面，使用 nuqs 更新参数
      setQuery(inputValue.trim());
      if (isAiOn) {
        setAiEnabled("true");
      } else {
        setAiEnabled(null); // 移除 ai 参数
      }
    } else {
      // 不在搜索页面，跳转到搜索页面
      const params = new URLSearchParams();
      params.set("q", inputValue.trim());
      // 只在 AI 开启时才添加 ai 参数
      if (isAiOn) {
        params.set("ai", "true");
      }
      router.push(`/search?${params.toString()}`);
    }
  };

  // 处理输入框变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // 在搜索页面且 AI 关闭时，实时同步路由
    if (isOnSearchPage && !isAiOn) {
      if (value.trim()) {
        setQuery(value.trim());
      } else {
        setQuery(null); // 清空查询参数
      }
    }
  };

  // 处理回车键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // 处理 AI 开关切换
  const handleAiToggle = (checked: boolean) => {
    setIsAiOn(checked);
    if (isOnSearchPage) {
      if (checked) {
        setAiEnabled("true");
      } else {
        setAiEnabled(null); // 移除 ai 参数
        // AI 关闭时，如果有输入内容，立即同步到路由
        if (inputValue.trim()) {
          setQuery(inputValue.trim());
        }
      }
    }
  };

  return (
    <div className={cn("relative flex items-center gap-3", className)}>
      {/* 搜索输入框 */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-20"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleSearch}
          disabled={!inputValue.trim()}
          className="absolute right-1 top-1/2 h-7 -translate-y-1/2"
        >
          搜索
        </Button>
      </div>

      {/* AI 开关 */}
      <div className="flex items-center gap-2">
        <Switch
          id="ai-search"
          checked={isAiOn}
          onCheckedChange={handleAiToggle}
          className="data-[state=checked]:bg-blue-600"
        />
        <Label
          htmlFor="ai-search"
          className="flex items-center gap-1 text-sm font-medium cursor-pointer"
        >
          <Sparkles
            className={cn(
              "h-4 w-4 transition-colors",
              isAiOn ? "text-blue-600" : "text-muted-foreground"
            )}
          />
          AI
        </Label>
      </div>
    </div>
  );
}
