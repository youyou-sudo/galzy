/**
 * @CLIENT_ONLY — 纯客户端 UI 状态，SSR 只读默认值。
 */
import { createStore } from '@tanstack/react-store'

type ModalState<T = any> = {
  open: boolean
  data: T | null
}

export const downCardStore = createStore<ModalState>({
  open: false,
  data: null,
})

export const downmodalActions = {
  open(data: any) {
    downCardStore.setState((s) => ({
      ...s,
      open: true,
      data,
    }))
  },

  // ⚠ 关闭时保留 data：Base UI Dialog 的退场动画（fade/zoom-out）期间
  // popup 仍挂载，如果这里立刻把 data 置空，关闭的 100ms 内内容会突然
  // 变成「未知大小 / 空文件名」并导致弹窗高度塌陷——表现就是关闭瞬间抖动、
  // 数据消失。data 只在下次 open 时被新条目覆盖，无额外状态成本。
  setOpen(open: boolean) {
    downCardStore.setState((s) => ({
      ...s,
      open,
    }))
  },

  close() {
    downCardStore.setState((s) => ({
      ...s,
      open: false,
    }))
  },

  updateData(partial: Partial<{ id: string; name?: string }>) {
    downCardStore.setState((s) => ({
      ...s,
      data: s.data ? { ...s.data, ...partial } : null,
    }))
  },
}
