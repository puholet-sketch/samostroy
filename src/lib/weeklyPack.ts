/** Еженедельный пакет клиенту: сборка дневных отчётов прораба за сб→пт. */

import { loadClients, type ClientObject } from './clients'
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

/** Один объект внутри пакета клиента (сб→пт). */
export type WeeklyPackObjectSection = {
  objectId: string
  objectTitle: string
  objectAddress: string
  token: string
  days: WeeklyPackDay[]
  filledDays: number
  mediaTotal: number
}

export type WeeklyPack = {
  clientId: string
  clientName: string
  from: string
  to: string
  /** Пятница = день отчёта клиенту */
  reportDay: string
  /** Все объекты «в работе» клиента (или один fallback) */
  objects: WeeklyPackObjectSection[]
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

function pickPackObjects(
  all: ClientObject[],
  preferredObjectId?: string,
): ClientObject[] {
  const inWork = all.filter((o) => o.inWork)
  if (inWork.length > 0) return inWork
  if (preferredObjectId) {
    const one = all.find((o) => o.id === preferredObjectId)
    if (one) return [one]
  }
  return all.slice(0, 1).filter(Boolean)
}

async function buildObjectSection(
  clientId: string,
  object: ClientObject,
  from: string,
  to: string,
): Promise<WeeklyPackObjectSection> {
  const link = getOrCreateControlLink({
    clientId,
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
    objectId: object.id,
    objectTitle: object.title || object.address || 'Объект',
    objectAddress: object.address || object.title || '',
    token: link.token,
    days,
    filledDays: days.filter((d) => d.report).length,
    mediaTotal: days.reduce((s, d) => s + d.media.length, 0),
  }
}

/**
 * Пакет за неделю сб→пт по клиенту: все объекты «в работе».
 * `objectId` — только fallback, если у клиента нет inWork (старые ссылки).
 */
export async function buildWeeklyPack(opts: {
  clientId: string
  objectId?: string
  from?: string
  to?: string
}): Promise<WeeklyPack | null> {
  const clients = loadClients()
  const client = clients.find((c) => c.id === opts.clientId)
  if (!client) return null

  const targets = pickPackObjects(client.objects ?? [], opts.objectId)
  if (targets.length === 0) return null

  const { from, to } = resolveWeeklyRange({ from: opts.from, to: opts.to })
  const objects: WeeklyPackObjectSection[] = []
  for (const object of targets) {
    objects.push(await buildObjectSection(client.id, object, from, to))
  }

  return {
    clientId: client.id,
    clientName: client.name || '',
    from,
    to,
    reportDay: to,
    objects,
    filledDays: objects.reduce((s, o) => s + o.filledDays, 0),
    mediaTotal: objects.reduce((s, o) => s + o.mediaTotal, 0),
  }
}
