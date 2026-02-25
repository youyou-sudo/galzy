import type { GameModel } from '@api/modules/games/model'
import type { getFileList } from '@web/lib/repositories/alistFileList'
import { create } from 'zustand'

export const downCardDataStore = create<{
  data: GameModel.TreeNode | null
  isOpen: boolean
  timeoutId: ReturnType<typeof setTimeout> | null
  open: () => void
  close: () => void
  setOpen: (open: boolean) => void
  setData: (data: GameModel.TreeNode) => void
  cleanup: () => void
}>((set, get) => ({
  data: null,
  isOpen: false,
  timeoutId: null,
  setOpen: (open) => set({ isOpen: open }),
  open: () => {
    const { timeoutId } = get()
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    set({ isOpen: true, timeoutId: null })
  },
  close: () => {
    const { timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)

    set({ isOpen: false })
    const newTimeoutId = setTimeout(() => {
      set({ data: null, timeoutId: null })
    }, 300)
    set({ timeoutId: newTimeoutId })
  },
  setData: (data) => set({ data }),
  cleanup: () => {
    const { timeoutId } = get()
    if (timeoutId) {
      clearTimeout(timeoutId)
      set({ timeoutId: null, data: null, isOpen: false })
    }
  }
}))
