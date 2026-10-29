/** Еженедельный пакет клиенту: сборка дневных отчётов прораба за сб→пт. */

import { loadClients } from './clients'
import {
  enumerateIsoDates,
  getOrCreateControlLink,
  getReportForDate,
  hydrateReportsForToken,
  type ObjectDailyReport,
  type ReportMediaMeta,
} from './objectReports'
import { fullWeekSatFri, shiftWeekSatFri } from './weekRange'

export type WeeklyPackDay = {
  date: string
  weekdayRu: string
  report: ObjectDailyReport | null
  shortWork: string
  shortProblems: string
  media: ReportMediaMeta[]
}

export type WeeklyPack = {
  clientId: string
  objectId: string
  clientName: string
  objectTitle: string
  objectAddress: string
  token: string
  from: string
  to: string
  /** Пятница = день отчёта клиенту */
  reportDay: string
  days: WeeklyPackDay[]
  filledDays: number
  mediaTotal: number
}

const WEEKDAY_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function shortText(s: string, max = 160): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function weekLabelRu(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }
  return `${fmt(from)} — ${fmt(to)}`
}

export function resolveWeeklyRange(opts?: {
  from?: string
  to?: string
  ref?: Date
}): { from: string; to: string } {
  if (opts?.from && opts?.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) && /^\d{4}-\d{2}-\d{2}$/.test(opts.to)) {
    return { from: opts.from, to: opts.to }
  }
  if (opts?.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from)) {
    return fullWeekSatFri(new Date(`${opts.from}T12:00:00`))
  }
  return fullWeekSatFri(opts?.ref ?? new Date())
}

export { shiftWeekSatFri, fullWeekSatFri }

export async function buildWeeklyPack(opts: {
  clientId: string
  objectId: string
  from?: string
  to?: string
}): Promise<WeeklyPack | null> {
  const clients = loadClients()
  const client = clients.find((c) => c.id === opts.clientId)
  if (!client) return null
  const object = (client.objects ?? []).find((o) => o.id === opts.objectId)
  if (!object) return null

  const { from, to } = resolveWeeklyRange({ from: opts.from, to: opts.to })
  const link = getOrCreateControlLink({
    clientId: client.id,
    objectId: object.id,
    objectTitle: object.title || object.address,
    objectAddress: object.address,
  })
  await hydrateReportsForToken(link.token)

  const dates = enumerateIsoDates(from, to)
  const days: WeeklyPackDay[] = dates.map((date) => {
    const report = getReportForDate(link.token, date) ?? null
    const dow = new Date(`${date}T12:00:00`).getDay()
    return {
      date,
      weekdayRu: WEEKDAY_RU[dow] ?? '',
      report,
      shortWork: report ? shortText(report.workDone) : '',
      shortProblems: report ? shortText(report.problems, 120) : '',
      media: report?.media?.filter((m) => m.kind === 'image' || m.kind === 'video') ?? [],
    }
  })

  return {
    clientId: client.id,
    objectId: object.id,
    clientName: client.name || '',
    objectTitle: object.title || object.address || 'Объект',
    objectAddress: object.address || object.title || '',
    token: link.token,
    from,
    to,
    reportDay: to,
    days,
    filledDays: days.filter((d) => d.report).length,
    mediaTotal: days.reduce((s, d) => s + d.media.length, 0),
  }
}
