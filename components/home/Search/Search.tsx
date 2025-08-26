"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "@bprogress/next/app";
import { useQueryState } from "nuqs";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

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

  const [isFocused, setIsFocused] = useState(false);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // // 处理 AI 开关切换
  // const handleAiToggle = (checked: boolean) => {
  //   setIsAiOn(checked);
  //   if (isOnSearchPage) {
  //     if (checked) {
  //       setAiEnabled("true");
  //     } else {
  //       setAiEnabled(null); // 移除 ai 参数
  //       // AI 关闭时，如果有输入内容，立即同步到路由
  //       if (inputValue.trim()) {
  //         setQuery(inputValue.trim());
  //       }
  //     }
  //   }
  // };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div className="relative">
        <div
          className={`
            relative flex items-center gap-2 p-3
            bg-background rounded-lg border transition-all duration-200
            ${
              isFocused
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/50"
            }
          `}
        >
          <Search
            className={`w-5 h-5 text-muted-foreground transition-colors duration-200 ${
              isFocused ? "text-primary" : ""
            }`}
          />

          <Input
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e)}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="
              flex-1 border-0 bg-transparent
              placeholder:text-muted-foreground
              focus-visible:ring-0 focus-visible:ring-offset-0
              h-9
            "
          />

          <Button
            onClick={handleSearch}
            disabled={!query.trim()}
            size="sm"
            className={`
              px-4 font-medium rounded-md transition-all duration-200
              ${
                query.trim()
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }
            `}
          >
            搜索
          </Button>
        </div>
      </div>
    </div>
  );
}
