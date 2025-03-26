import { atom, useAtom } from "jotai";

const sidebarOpenAtom = atom(false);

export const useSidebarStore = () => {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return { sidebarOpen, toggleSidebar, setSidebarOpen };
};
