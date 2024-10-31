import { auth, signOut } from "@/auth";
import ItemLink from "./(components)/ItemLink";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session.user.identity !== "admin")
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-2/6">
        <h2>当前 {session.user?.email} 没有管理员权限，请联系管理员</h2>
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
    <div className="flex gap-3">
      <ItemLink pathdata={siteConfig} />
      <div className="container mx-auto">{children}</div>
    </div>
  );
}
