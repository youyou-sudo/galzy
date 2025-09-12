// store/useEditDialog.ts
import type { vidassociationGet } from '@web/lib/dashboard/dataManagement/dataGet'
import { create } from 'zustand'

type DataTy = Awaited<ReturnType<typeof vidassociationGet>>

interface EditDialogState {
  isOpen: boolean
  data: DataTy | null
  open: () => void
  close: () => void
  dataget: (data: any) => void
}

export const useEditDialog = create<EditDialogState>((set) => ({
  isOpen: false,
  data: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, data: null }),
  dataget: (data) => set({ data }),
}))
