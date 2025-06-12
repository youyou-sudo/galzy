import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/animate-ui/radix/dialog";
import { Plus } from "lucide-react";

export const AddSubDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          添加条目
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Please read the following terms of service carefully.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam,
            quos. Lorem ipsum dolor sit amet consectetur adipisicing elit.
            Quisquam, quos.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline">Decline</Button>
          <Button type="submit">Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
