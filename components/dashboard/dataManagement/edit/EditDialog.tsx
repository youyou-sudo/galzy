"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/radix/dialog";
import { useEditDialog } from "../stores/useEditDialog";
import EditComponent from "./EditComponent";

export default function EditDialog() {
  const { isOpen, close } = useEditDialog();

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="sm:max-w-7xl" from="right">
        <DialogHeader>
          <DialogTitle>编辑内容</DialogTitle>
        </DialogHeader>
        <EditComponent />
      </DialogContent>
    </Dialog>
  );
}
