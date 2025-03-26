import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formSchemaVndb } from "@/schemas/formSchema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormValues = z.infer<typeof formSchemaVndb>;

interface EditDataFormProps {
  initialValues: FormValues;
  onSubmit: (values: FormValues) => void;
}

export default function EditDataForm({
  initialValues,
  onSubmit,
}: EditDataFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchemaVndb),
    defaultValues: initialValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-2 flex flex-col"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="数据名称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="jsonurl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data Url</FormLabel>
              <FormControl>
                <Input placeholder="数据 URL" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="timeVersion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>数据更新 URL</FormLabel>
              <FormControl>
                <Input placeholder="数据时间 URL" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>数据更新 URL</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="数据类别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Type?</SelectLabel>
                      <SelectItem value="TagAssVn">TagAssVn</SelectItem>
                      <SelectItem value="alistData">alistData</SelectItem>
                      <SelectItem value="VndbData">VndbData</SelectItem>
                      <SelectItem value="tagData">tagData</SelectItem>
                      <SelectItem value="VnImages">VnImages</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="ml-auto" type="submit">
          提交
        </Button>
      </form>
    </Form>
  );
}
