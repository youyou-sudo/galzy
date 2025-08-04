import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TestComponent from "@/components/dashboard/dataManagement/edit/EditComponent";

export default function page() {
  return (
    <div>
      Card Test pages
      <Dialog defaultOpen={true} modal={true}>
        <form>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent className="w-full sm:min-w-full h-full sm:min-h-full">
            <DialogHeader>
              <DialogTitle>条目信息</DialogTitle>
              <DialogDescription>Title</DialogDescription>
            </DialogHeader>
            <TestComponent />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>
    </div>
  );
}
