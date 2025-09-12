import type { getFileList } from '@web/lib/repositories/alistFileList'
import { create } from 'zustand'

let clearTimeoutId: ReturnType<typeof setTimeout> | null = null

type fileList = NonNullable<Awaited<ReturnType<typeof getFileList>>>

export const downCardDataStore = create<{
  data: fileList[number] | null
  isOpen: boolean
  open: () => void
  close: () => void
  setOpen: (open: boolean) => void
  setData: (data: fileList[number]) => void
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
