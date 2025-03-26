import { auth, signOut } from "@/auth";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import SidebarAssembly from "@/components/dashboardUi";
import SidePanelSwitch from "@/components/sidePanelSwitch";
import { Button } from "@/components/ui/button";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();
  const session = await auth();
  if (session?.user?.identity !== "admin")
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-2/6">
        <h2>当前 {session?.user?.email} 没有管理员权限，请联系管理员</h2>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <Button type="submit">注销当前账号</Button>
        </form>
      </div>
    );
  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="text-foreground">
          <SidebarAssembly />
          <main className="container mx-auto md:pl-64 md:p-3 md:pt-2">
            <SidePanelSwitch />
            <BreadcrumbNav className="mb-4" />
            {children}
          </main>
        </div>
      </HydrationBoundary>
    </>
  );
}
