import { create } from 'zustand'

export const downloadStore = create<{
  data: any | null
  isOpen: boolean
  timeoutId: ReturnType<typeof setTimeout> | null
  open: () => void
  close: () => void
  setOpen: (open: boolean) => void
  setData: (data: any) => void
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
}))
