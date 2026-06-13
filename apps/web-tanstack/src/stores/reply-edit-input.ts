import { createStore } from '@tanstack/react-store'

type ModalState<T = any> = {
  openReId: string | null
  data: T | null
}

export const replyCardStore = createStore<ModalState>({
  openReId: null,
  data: null,
})

export const replycardActions = {
  openReId(reId: string, data: any) {
    replyCardStore.setState((s) => ({
      ...s,
      openReId: reId === s.openReId ? null : reId,
      data: data,
    }))
  },

  setOpen(reId: string | null) {
    replyCardStore.setState((s) => ({
      ...s,
      openReId: reId,
      data: reId ? s.data : null,
    }))
  },

  close() {
    replyCardStore.setState((s) => ({
      ...s,
      openReId: null,
      data: null,
    }))
  },

  updateData(
    partial: Partial<{ id: string; userName?: string; userId?: string }>,
  ) {
    replyCardStore.setState((s) => ({
      ...s,
      data: s.data ? { ...s.data, ...partial } : null,
    }))
  },
}
