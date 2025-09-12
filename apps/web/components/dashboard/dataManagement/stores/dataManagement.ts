import { create } from 'zustand'

let clearTimeoutId: ReturnType<typeof setTimeout> | null = null

import { persist } from 'zustand/middleware'

export const dataManagementModalStores = create<{
  data: any | null
  isOpen: boolean
  open: () => void
  close: () => void
  setOpen: (open: boolean) => void
  setData: (data: any) => void
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

type PaginationState = {
  datapage: number
  limit: number
  setDatapage: (page: number) => void
  setLimit: (limit: number) => void
}

export const usePaginationStore = create<PaginationState>()(
  persist(
    (set) => ({
      datapage: 1,
      limit: 20,
      setDatapage: (page) => set({ datapage: page }),
      setLimit: (limit) => set({ limit }),
    }),
    {
      name: 'pagination-storage', // 存到 localStorage 的 key
    },
  ),
)

type FilterState = {
  filterNusq: string | null
  setFilterNusq: (filter: string | null) => void
  getRequestParams: (filter: string | null) => Record<string, any>
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      filterNusq: 'All',
      setFilterNusq: (filter) => set({ filterNusq: filter }),
      getRequestParams: (filter) => {
        switch (filter) {
          case 'NoVndb':
            return { otherId: 1 }
          case 'NotSupplemented':
            return { vid: 1 }
          case 'Supplemented':
            return { vid: 1, otherId: 1 }
          default:
            return {}
        }
      },
    }),
    {
      name: 'filter-storage',
    },
  ),
)
