import { create } from 'zustand'

interface strategyListDialogState {
  isOpen: boolean
  id: string | null
  open: () => void
  close: () => void
  dataget: (data: any) => void
  toggleModal: () => void
}

export const useStrategyListDialog = create<strategyListDialogState>((set) => ({
  isOpen: false,
  id: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, id: null }),
  dataget: (id) => set({ id: id }),
  toggleModal: () => set((state) => ({ isOpen: !state.isOpen })),
}))
