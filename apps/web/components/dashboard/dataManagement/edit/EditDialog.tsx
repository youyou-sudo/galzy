'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@shadcn/ui/components/animate-ui/components/radix/dialog'
import { useEditDialog } from '../stores/useEditDialog'
import EditComponent from './EditComponent'

export default function EditDialog() {
  const { isOpen, close, data } = useEditDialog()

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="sm:max-w-7xl" from="right">
        <DialogHeader>
          <DialogTitle>编辑内容 {data?.id}</DialogTitle>
        </DialogHeader>
        <EditComponent />
      </DialogContent>
    </Dialog>
  )
}
