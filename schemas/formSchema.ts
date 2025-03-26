import { z } from "zod";

export const formSchemaVndb = z.object({
  name:z.string({message:"请输入字符串"}),
  jsonurl: z.string().url({ message: "Invalid URL" }),
  timeVersion: z.string().url({
    message: "Invalid URL",
  }),
  type:z.string({message:"请输入字符串"})
});
