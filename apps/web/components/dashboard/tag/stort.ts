import { create } from 'zustand'
import type { tagAllAction } from './(action)/action'

type DataTy = Awaited<ReturnType<typeof tagAllAction>>
type NoNullDataTy = NonNullable<DataTy>

interface EditDialogState {
  isOpen: boolean
  data: NoNullDataTy['items'][number] | null
  open: () => void
  close: () => void
  dataget: (data: any) => void
}

export const useTagEditDialog = create<EditDialogState>((set) => ({
  isOpen: false,
  data: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, data: null }),
  dataget: (data) => set({ data }),
}))
