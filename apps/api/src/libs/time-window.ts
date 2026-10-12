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
