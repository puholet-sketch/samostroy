/**
 * Сводный отчёт по всем объектам за период.
 * Данные: localStorage control links + objectReports (как ObjectControlPage).
 * Позже: тот же контракт можно читать с Docker API, не меняя UI.
 */

import { loadClients } from './clients'
import {
  enumerateIsoDates,
  getReportForDate,
  listControlLinks,
  todayIso,
  type ObjectDailyReport,
} from './objectReports'

export type PeriodReportStatus = 'есть' | 'нет отчёта'

export type PeriodReportRow = {
  objectTitle: string
  objectAddress: string
  clientName: string
  date: string
  workerName: string
  workDone: string
  problems: string
  mediaCount: number
  status: PeriodReportStatus
}

export type PeriodObjectRef = {
  key: string
  clientId: string
  objectId: string
  clientName: string
  objectTitle: string
  objectAddress: string
  token: string | null
}

/** Объекты клиентов + сироты из control links (legacy / без карточки). */
export function collectPeriodObjects(): PeriodObjectRef[] {
  const clients = loadClients()
  const byKey = new Map<string, PeriodObjectRef>()
  const clientNameById = new Map(clients.map((c) => [c.id, c.name || '']))

  for (const c of clients) {
    for (const o of c.objects ?? []) {
      const key = `${c.id}:${o.id}`
      byKey.set(key, {
        key,
        clientId: c.id,
        objectId: o.id,
        clientName: c.name || '',
        objectTitle: o.title || o.address || 'Объект',
        objectAddress: o.address || o.title || '',
        token: null,
      })
    }
  }

  for (const link of listControlLinks()) {
    const key =
      link.clientId && link.objectId && link.objectId !== 'legacy'
        ? `${link.clientId}:${link.objectId}`
        : `token:${link.token}`
    const existing = byKey.get(key)
    if (existing) {
      existing.token = link.token
      if (link.objectTitle) existing.objectTitle = link.objectTitle
      if (link.objectAddress) existing.objectAddress = link.objectAddress
      if (!existing.clientName && link.clientId) {
        existing.clientName = clientNameById.get(link.clientId) ?? ''
      }
    } else {
      byKey.set(key, {
        key,
        clientId: link.clientId,
        objectId: link.objectId,
        clientName: clientNameById.get(link.clientId) ?? '',
        objectTitle: link.objectTitle || 'Объект',
        objectAddress: link.objectAddress || '',
        token: link.token,
      })
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const addr = (a.objectAddress || a.objectTitle).localeCompare(
      b.objectAddress || b.objectTitle,
      'ru',
    )
    if (addr !== 0) return addr
    return a.key.localeCompare(b.key)
  })
}

function rowFromReport(
  obj: PeriodObjectRef,
  date: string,
  report: ObjectDailyReport | undefined,
): PeriodReportRow {
  if (report) {
    return {
      objectTitle: obj.objectTitle,
      objectAddress: obj.objectAddress,
      clientName: obj.clientName,
      date,
      workerName: report.workerName || '',
      workDone: report.workDone || '',
      problems: report.problems || '',
      mediaCount: report.media?.length ?? 0,
      status: 'есть',
    }
  }
  return {
    objectTitle: obj.objectTitle,
    objectAddress: obj.objectAddress,
    clientName: obj.clientName,
    date,
    workerName: '',
    workDone: '',
    problems: '',
    mediaCount: 0,
    status: 'нет отчёта',
  }
}

export type BuildPeriodReportOpts = {
  clientId?: string
  objectId?: string
  /** '' | 'has' | 'missing' */
  reportPresence?: '' | 'has' | 'missing'
  onlyInWork?: boolean
}

/**
 * Строки: каждый объект × каждый день периода (до сегодня включительно).
 * Будущие даты в диапазоне отбрасываются — как в календаре контроля.
 */
export function buildPeriodReportRows(
  from: string,
  to: string,
  opts: BuildPeriodReportOpts = {},
): PeriodReportRow[] {
  const today = todayIso()
  let fromIso = from
  let toIso = to
  if (fromIso > toIso) {
    const t = fromIso
    fromIso = toIso
    toIso = t
  }
  if (toIso > today) toIso = today
  if (fromIso > today) return []

  const dates = enumerateIsoDates(fromIso, toIso)
  const clients = loadClients()
  const inWorkKeys = new Set<string>()
  if (opts.onlyInWork) {
    for (const c of clients) {
      for (const o of c.objects ?? []) {
        if (o.inWork) inWorkKeys.add(`${c.id}:${o.id}`)
      }
    }
  }

  let objects = collectPeriodObjects()
  if (opts.clientId) {
    objects = objects.filter((o) => o.clientId === opts.clientId)
  }
  if (opts.objectId) {
    objects = objects.filter((o) => o.objectId === opts.objectId)
  }
  if (opts.onlyInWork) {
    objects = objects.filter((o) => inWorkKeys.has(`${o.clientId}:${o.objectId}`))
  }

  const rows: PeriodReportRow[] = []

  for (const obj of objects) {
    for (const date of dates) {
      const report = obj.token ? getReportForDate(obj.token, date) : undefined
      const row = rowFromReport(obj, date, report)
      if (opts.reportPresence === 'has' && row.status !== 'есть') continue
      if (opts.reportPresence === 'missing' && row.status !== 'нет отчёта') continue
      rows.push(row)
    }
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.objectAddress || a.objectTitle).localeCompare(
      b.objectAddress || b.objectTitle,
      'ru',
    )
  })

  return rows
}

export function defaultPeriodRange(): { from: string; to: string } {
  const to = todayIso()
  const d = new Date(`${to}T12:00:00`)
  d.setDate(d.getDate() - 6)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return { from: `${y}-${m}-${day}`, to }
}
