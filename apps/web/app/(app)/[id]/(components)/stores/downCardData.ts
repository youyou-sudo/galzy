import type { GameModel } from '@api/modules/games/model'
import type { getFileList } from '@web/lib/repositories/alistFileList'
import { create } from 'zustand'

let clearTimeoutId: ReturnType<typeof setTimeout> | null = null

export const downCardDataStore = create<{
  data: GameModel.TreeNode | null
  isOpen: boolean
  open: () => void
  close: () => void
  setOpen: (open: boolean) => void
  setData: (data: GameModel.TreeNode) => void
}>((set) => ({
  data: null,
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  open: () => {
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId)
      clearTimeoutId = null
    }
    set({ isOpen: true })
  },
  close: () => {
    set({ isOpen: false })
    if (clearTimeoutId) clearTimeout(clearTimeoutId)
    clearTimeoutId = setTimeout(() => {
      set({ data: null })
      clearTimeoutId = null
    }, 300)
  },
  setData: (data) => set({ data }),
}))
