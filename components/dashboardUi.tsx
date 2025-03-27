"use client";
import { Sidebar } from "@/components/app-sidebar";
import { useSidebarStore } from "@/store/sidebarStore";

export default function DashboardUi() {
  const { sidebarOpen, setSidebarOpen } = useSidebarStore();
  return (
    <>
      <div className="bg-background text-foreground">
        <div className="fixed -z-10 h-full w-full">
          <div className="absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-purple-300 blur-3xl dark:bg-purple-900"></div>
          <div className="absolute right-1/4 top-1/2 h-72 w-72 rounded-full bg-blue-300 blur-3xl dark:bg-blue-900"></div>
          <div className="absolute bottom-1/4 left-1/3 h-72 w-72 rounded-full bg-pink-300 blur-3xl dark:bg-pink-900"></div>
        </div>

        {/* Sidebar for desktop */}
        <Sidebar className="hidden md:flex" />

        {/* Mobile Sidebar */}
        <Sidebar
          isMobile
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-xs md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </>
  );
}
