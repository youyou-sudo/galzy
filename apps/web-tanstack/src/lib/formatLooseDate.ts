export function formatLooseDate(raw?: string) {
  if (!raw) {
    return { year: '', formatted: '' }
  }

  let y: string, m: string, d: string

  if (raw.includes('-')) {
    const parts = raw.split('-')
    if (parts.length !== 3) return { year: '', formatted: '' }
    y = parts[0]
    m = parts[1]
    d = parts[2]
  } else if (raw.length === 8) {
    y = raw.slice(0, 4)
    m = raw.slice(4, 6)
    d = raw.slice(6, 8)
  } else {
    return { year: '', formatted: '' }
  }

  const dNum = Number(d)

  const validDay = dNum >= 1 && dNum <= 31

  if (!validDay) {
    return { year: y, formatted: m }
  }

  return { year: y, formatted: `${m}-${d}` }
}
