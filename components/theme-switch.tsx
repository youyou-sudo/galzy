"use client";

import { type FC, useEffect, useState } from "react";
import type { SwitchProps } from "@nextui-org/switch";
import { useTheme } from "next-themes";
import { TbSunHigh, TbMoonFilled, TbDeviceDesktopCog } from "react-icons/tb";

import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@nextui-org/react";

export interface ThemeSwitchProps {
  className?: string;
  classNames?: SwitchProps["classNames"];
}

export const ThemeSwitch: FC<ThemeSwitchProps> = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly variant="light">
          {theme === "light" ? (
            <TbSunHigh size={24} />
          ) : theme === "system" ? (
            <TbDeviceDesktopCog size={20} />
          ) : (
            <TbMoonFilled size={20} />
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Theme Actions">
        <DropdownItem key="system" onPress={() => setTheme("system")}>
          跟随系统
        </DropdownItem>
        <DropdownItem key="light" onPress={() => setTheme("light")}>
          浅色模式
        </DropdownItem>
        <DropdownItem key="dark" onPress={() => setTheme("dark")}>
          深色模式
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};
