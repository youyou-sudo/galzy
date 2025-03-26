import type { LucideIcon } from "lucide-react";

export interface Ref {
  id: string;
  name: string;
  timeVersion: string;
  jsonurl: string;
  type: string;
}

export interface MenuItem {
  id: string;
  title: string;
  icon: LucideIcon;
  path: string;
  children?: MenuItem[];
}

export type Language = {
  lang: string;
};

export type Release = {
  id: string;
  title: string;
  platforms: string[];
  languages: Language[];
};

export type Screenshot = {
  url: string;
  thumbnail: string;
  dims: [number, number];
  thumbnail_dims: [number, number];
  release: Release;
};

export type ScreenshotData = {
  [releaseId: string]: Screenshot[];
};
