export function formatLooseDate(raw?: string) {
  if (!raw || raw.length !== 8) {
    return { year: '', formatted: '' }
  }

  const y = raw.slice(0, 4)
  const m = raw.slice(4, 6)
  const d = raw.slice(6, 8)

  const dNum = Number(d)

  const validDay = dNum >= 1 && dNum <= 31

  if (!validDay) {
    return { year: y, formatted: `${m}` }
  }

  return { year: y, formatted: `${m}-${d}` }
}
