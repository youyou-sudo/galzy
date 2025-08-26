"use client";
import { useEffect } from "react";

export function GameViewsTrackEvents({ idtitle }) {
  useEffect(() => {
    if (typeof umami !== "undefined") {
      umami.track("GameViews", { idtitlee: idtitle });
    }
  }, []);
  return null;
}

export function TagViewsTrackEvents({ tagtitle }) {
  useEffect(() => {
    if (typeof umami !== "undefined") {
      umami.track("TagViews", { tagtitle: tagtitle });
    }
  }, []);
  return null;
}
