/**
 * 站内排行榜（本周热门 / 本月热门）的时间窗口径。
 *
 * 全部按服务器本地时区切分自然周 / 自然月：views 模块的周榜与 tags 模块的
 * 「本周热门」排序必须落在同一个窗口，否则同一个「本周」在两个页面给出
 * 不同的名次。
 */

/** 本周一 00:00（本地时区） */
export function getWeekStart(now: Date = new Date()): Date {
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diff,
  )
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

/**
 * 排行榜口径的「本周」起点：周一整天仍展示上周数据（周一当天样本太少，
 * 直接切到新周会让榜单整片塌成空），周二 00:00 起切到本周。
 */
export function getEffectiveWeekStart(now: Date = new Date()): Date {
  if (now.getDay() === 1) {
    const prev = getWeekStart(now)
    prev.setDate(prev.getDate() - 7)
    return prev
  }
  return getWeekStart(now)
}

/** 本月 1 日 00:00（本地时区） */
export function getMonthStart(now: Date = new Date()): Date {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)
  return monthStart
}

/**
 * 本地时区日期（YYYY-MM-DD），缓存键用。
 *
 * 刻意不走 toISOString().slice(0, 10)：东八区的本地周一 00:00 是 UTC 周日
 * 16:00，ISO 切片会给出「前一天」。键值同样唯一，但排查缓存时会误判成另一个
 * 窗口。
 */
function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 周窗口标识：排行榜口径的周起始日（周一当周仍算上一周，见 getEffectiveWeekStart） */
export function getWeekKey(now: Date = new Date()): string {
  return localDateKey(getEffectiveWeekStart(now))
}

/**
 * 时间窗聚合结果的缓存键标识：周窗口 + 月窗口。
 *
 * 时间窗聚合（热门榜、标签库的「本周 / 本月热门」）只能服务同一个窗口：窗口一
 * 翻页（周二 00:00 换周、每月 1 日 00:00 换月），旧键里的数据就不再是「本周 /
 * 本月」了。缓存键带上它，边界一过自然 miss 并重新聚合，不必指望 TTL 恰好
 * 在边界前后过期。
 */
export function getWindowKey(now: Date = new Date()): string {
  return `${getWeekKey(now)}:${localDateKey(getMonthStart(now))}`
}
