import { create } from 'zustand'

export interface ContentData {
  title: string
  content: string
  copyright: string | null
}

interface Data {
  id?: string
  data?: ContentData
}

interface LoginModalStore {
  isOpen: boolean
  data: Data
  create: boolean
  setdata: (data: Data) => void
  setcreate: (create: boolean) => void
  openModal: () => void
  closeModal: () => void
  toggleModal: () => void
}

export const useLoginModalStore = create<LoginModalStore>((set) => ({
  isOpen: false,
  data: {},
  create: false,
  setcreate: (create: boolean) => set({ create }),
  setdata: (data: Data) => set({ data }),
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false, data: {}, create: false }),
  toggleModal: () =>
    set((state) => {
      if (state.isOpen) {
        return { isOpen: false, data: {}, create: false }
      } else {
        return { isOpen: true }
      }
    }),
}))
