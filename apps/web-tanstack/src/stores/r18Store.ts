import { createStore } from '@tanstack/react-store'

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('r18-blur') : null
const defaultEnabled = stored !== null ? stored === 'true' : true

export const r18Store = createStore({
  blurEnabled: defaultEnabled,
})

export const r18Actions = {
  toggle() {
    r18Store.setState((s) => {
      const next = !s.blurEnabled
      localStorage.setItem('r18-blur', String(next))
      return { ...s, blurEnabled: next }
    })
  },
}
