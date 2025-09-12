"use client"
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { gameTagsAction, TagAllFileDwn } from "@web/components/dashboard/tag/(action)/action";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";


export function UpComp() {


  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormData) => {
      await gameTagsAction(values)
    },
  })

  const { mutate: tagAllFileDwn, isPending: tagAllFileDwnPending } = useMutation({
    mutationFn: async () => {
      const datas = await TagAllFileDwn()
      const jsonStr = JSON.stringify(datas, null, 2);
      const blob = new Blob([jsonStr!], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "TagZhAll.json";
      a.click();

      URL.revokeObjectURL(url);
    },
  })
  async function onSubmit(values: FormData) {
    mutate(values);
  }

  return (<>
    <form action={onSubmit} className="flex items-center space-x-2">
      <Input name="file" type="file" />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending && <Loader2Icon className="animate-spin" />}
        更新
      </Button>
    </form>

    <Button onClick={() => tagAllFileDwn()} size="sm" disabled={tagAllFileDwnPending}>
      {tagAllFileDwnPending && <Loader2Icon className="animate-spin" />}
      下载 JSON
    </Button></>
  );
}
