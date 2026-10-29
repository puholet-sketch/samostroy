/** Неделя KPI / отчётов: суббота → пятница (локальная дата). */

import { collectPeriodObjects } from './periodReport'
import { datesWithReports, enumerateIsoDates, todayIso } from './objectReports'

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Суббота начала недели Sat–Fri, содержащей ref. */
export function weekSatContaining(ref = new Date()): Date {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dow = today.getDay() // 0=Sun … 6=Sat
  const daysSinceSat = (dow + 1) % 7
  const sat = new Date(today)
  sat.setDate(today.getDate() - daysSinceSat)
  return sat
}

/** Полная неделя сб→пт (без обрезки по сегодня). День отчёта клиенту — пятница. */
export function fullWeekSatFri(ref = new Date()): { from: string; to: string } {
  const sat = weekSatContaining(ref)
  const fri = new Date(sat)
  fri.setDate(sat.getDate() + 6)
  return { from: toIso(sat), to: toIso(fri) }
}

/** Сдвиг недели на delta недель (отриц. = назад). */
export function shiftWeekSatFri(
  fromIso: string,
  deltaWeeks: number,
): { from: string; to: string } {
  const sat = new Date(`${fromIso.slice(0, 10)}T12:00:00`)
  sat.setDate(sat.getDate() + deltaWeeks * 7)
  return fullWeekSatFri(sat)
}

/** Текущая неделя Sat–Fri, обрезанная по «сегодня» (будущие дни не считаем). */
export function currentWeekSatFri(ref = new Date()): { from: string; to: string } {
  const { from, to: fri } = fullWeekSatFri(ref)
  const today = toIso(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()))
  const to = fri > today ? today : fri
  return { from, to }
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
