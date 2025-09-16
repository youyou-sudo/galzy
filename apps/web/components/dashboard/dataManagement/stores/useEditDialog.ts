// store/useEditDialog.ts
import type { Game } from '@api/modules/games/service'
import { create } from 'zustand'

type DataTy = Awaited<ReturnType<typeof Game.VidassociationGet>>

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
