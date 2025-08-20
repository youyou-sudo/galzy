import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
} from "@/components/animate-ui/radix/tabs";
import { DownloadOptions } from "@/app/(app)/[id]/(components)/download-options";
import { ArrowDownToLine } from "lucide-react";
import { getFileList } from "@/lib/repositories/alistFileList";
import StrategyList from "@/components/dashboard/dataManagement/strategy/strategyList";
import { TagsCard } from "./tags";

export const TapCatd = async ({ id }: { id: string }) => {
  const fileList = await getFileList(id);
  return (
    <Tabs defaultValue="download" className="rounded-lg">
      <TabsList>
        <TabsTrigger value="download">
          <ArrowDownToLine className="h-4 w-4" />
          下载
        </TabsTrigger>
        <TabsTrigger value="Introduction">攻略</TabsTrigger>
        <TabsTrigger value="Info">信息</TabsTrigger>
      </TabsList>

      <TabsContents className="-mt-2 rounded-sm h-full">
        <TabsContent value="download" className="space-y-6">
          <DownloadOptions fileList={fileList} />
        </TabsContent>
        <TabsContent value="Introduction" className="space-y-6 pt-2">
          <StrategyList id={id} />
        </TabsContent>
        <TabsContent value="Info" className="space-y-6 pt-2">
          <TagsCard id={id} />
        </TabsContent>
      </TabsContents>
    </Tabs>
  );
};
