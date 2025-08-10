import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MeiliSearchInput } from "./MeiSearch-input";

export const MeiliSearch = () => {
  return (
    <div>
      {/* [ ] 后台 Meilsearch 配置项
       */}
      <Card>
        <CardHeader>
          <CardTitle>MeiliSearch 配置</CardTitle>
          <CardDescription> MeiliSearch </CardDescription>
        </CardHeader>
        <CardContent>
          <MeiliSearchInput />
        </CardContent>
      </Card>
    </div>
  );
};
