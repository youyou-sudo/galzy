import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const dataManagementModalStores = create<{
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
