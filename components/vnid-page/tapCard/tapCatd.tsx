import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
} from "@/components/animate-ui/radix/tabs";
import { DownloadOptions } from "@/components/vnid-page/tapCard/download-options";
import { ArrowDownToLine } from "lucide-react";
import { getFileList } from "@/lib/repositories/alistFileList";

export const TapCatd = async ({ id }: { id: string }) => {
  const fileList = await getFileList(id);
  return (
    <Tabs defaultValue="download" className="rounded-lg">
      <TabsList className="grid">
        <TabsTrigger value="download">
          <ArrowDownToLine className="h-4 w-4" />
          下载
        </TabsTrigger>
        {/* <TabsTrigger value="Introduction">简介</TabsTrigger> */}
      </TabsList>

      <TabsContents className="-mt-2 rounded-sm h-full">
        <TabsContent value="download" className="space-y-6">
          <DownloadOptions fileList={fileList} />
        </TabsContent>
        {/* <TabsContent value="Introduction" className="space-y-6 p-6">
          简介
        </TabsContent> */}
      </TabsContents>
    </Tabs>
  );
};
