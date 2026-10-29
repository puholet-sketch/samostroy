/** Неделя KPI / отчётов: суббота → пятница (локальная дата). */

import { collectPeriodObjects } from './periodReport'
import { datesWithReports, enumerateIsoDates, todayIso } from './objectReports'

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Текущая неделя Sat–Fri, обрезанная по «сегодня» (будущие дни не считаем). */
export function currentWeekSatFri(ref = new Date()): { from: string; to: string } {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dow = today.getDay() // 0=Sun … 6=Sat
  // Суббота начала недели: если сегодня сб (6) — сегодня; иначе назад до сб
  const daysSinceSat = (dow + 1) % 7
  const sat = new Date(today)
  sat.setDate(today.getDate() - daysSinceSat)
  const fri = new Date(sat)
  fri.setDate(sat.getDate() + 6)
  const to = fri > today ? today : fri
  return { from: toIso(sat), to: toIso(to) }
}

export type WeekKpi = {
  from: string
  to: string
  filled: number
  missing: number
  objects: number
  days: number
}

/** KPI по всем объектам клиентов (+ сироты control links) за текущую неделю. */
export function computeWeekReportKpi(ref = new Date()): WeekKpi {
  const { from, to } = currentWeekSatFri(ref)
  const days = enumerateIsoDates(from, to)
  const objects = collectPeriodObjects()
  let filled = 0
  let missing = 0
  for (const obj of objects) {
    const reported = obj.token ? datesWithReports(obj.token) : new Set<string>()
    for (const date of days) {
      if (reported.has(date)) filled += 1
      else missing += 1
    }
  }
  return {
    from,
    to,
    filled,
    missing,
    objects: objects.length,
    days: days.length,
  }
}

export { todayIso }
