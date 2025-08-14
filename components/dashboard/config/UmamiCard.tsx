import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UmamiCardInput } from "./UmamiCard-Input";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { umamiConfigGet } from "@/lib/dashboard/config/UmamiFormAc";

export function UmamiCard() {
  const queryClient = new QueryClient();
  queryClient.prefetchQuery({
    queryKey: ["umamiConfig"],
    queryFn: async () => {
      const response = await umamiConfigGet();
      return response;
    },
  });
  return (
    <div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Card>
          <CardHeader>
            <CardTitle>Umami 配置</CardTitle>
            <CardDescription> Umami </CardDescription>
          </CardHeader>
          <CardContent>
            <UmamiCardInput />
          </CardContent>
        </Card>
      </HydrationBoundary>
    </div>
  );
}
