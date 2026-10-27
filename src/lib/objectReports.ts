/** Публичные отчёты по объекту (токен ссылки → отчёты по датам).
 * Локально: localStorage. При настроенном Feedback/API URL — ещё и Postgres через REST.
 */

import {
  fetchControlLinkRemote,
  fetchObjectReportsRemote,
  isObjectReportsApiConfigured,
  postControlLinkRemote,
  postObjectReportRemote,
} from './objectReportsApi'

export type ReportMediaMeta = {
  id: string
  name: string
  mime: string
  size: number
  kind: 'image' | 'video' | 'file'
}

export type ObjectDailyReport = {
  id: string
  token: string
  date: string // YYYY-MM-DD
  workDone: string
  problems: string
  workerName: string
  media: ReportMediaMeta[]
  createdAt: string
}

export type ControlLink = {
  token: string
  clientId: string
  objectId: string
  objectTitle: string
  objectAddress: string
}

const LINKS_KEY = 'samostroy:control_links_v2'
const LEGACY_LINK_KEY = 'samostroy:control_link_v1'
const REPORTS_KEY = 'samostroy:object_reports_v1'
const SELECT_KEY = 'samostroy:control_selection_v1'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function listControlLinks(): ControlLink[] {
  return loadLinks()
}

/** Inclusive ISO date range YYYY-MM-DD → YYYY-MM-DD */
export function enumerateIsoDates(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  const cur = new Date(`${fromIso.slice(0, 10)}T12:00:00`)
  const end = new Date(`${toIso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return out
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function loadLinks(): ControlLink[] {
  try {
    const raw = localStorage.getItem(LINKS_KEY)
    if (raw) {
      const list = JSON.parse(raw) as ControlLink[]
      if (Array.isArray(list)) return list
    }
  } catch {
    /* ignore */
  }
  // миграция со старого одиночного линка
  try {
    const legacy = localStorage.getItem(LEGACY_LINK_KEY)
    if (legacy) {
      const one = JSON.parse(legacy) as {
        token: string
        objectTitle: string
        objectAddress: string
      }
      const migrated: ControlLink = {
        token: one.token,
        clientId: '',
        objectId: 'legacy',
        objectTitle: one.objectTitle || 'Объект',
        objectAddress: one.objectAddress || '',
      }
      saveLinks([migrated])
      return [migrated]
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveLinks(list: ControlLink[]) {
  localStorage.setItem(LINKS_KEY, JSON.stringify(list))
}

export function getOrCreateControlLink(opts: {
  clientId: string
  objectId: string
  objectTitle: string
  objectAddress: string
}): ControlLink {
  const list = loadLinks()
  const found = list.find(
    (l) => l.clientId === opts.clientId && l.objectId === opts.objectId,
  )
  if (found) {
    const updated: ControlLink = {
      ...found,
      objectTitle: opts.objectTitle || found.objectTitle,
      objectAddress: opts.objectAddress || found.objectAddress,
    }
    if (
      updated.objectTitle !== found.objectTitle ||
      updated.objectAddress !== found.objectAddress
    ) {
      saveLinks(list.map((l) => (l.token === found.token ? updated : l)))
    }
    void syncControlLinkRemote(updated)
    return updated
  }
  const link: ControlLink = {
    token: `ctrl-${Math.random().toString(36).slice(2, 10)}`,
    clientId: opts.clientId,
    objectId: opts.objectId,
    objectTitle: opts.objectTitle || 'Объект',
    objectAddress: opts.objectAddress || '',
  }
  list.push(link)
  saveLinks(list)
  void syncControlLinkRemote(link)
  return link
}

function syncControlLinkRemote(link: ControlLink) {
  if (!isObjectReportsApiConfigured()) return
  return postControlLinkRemote(link).catch((e) => {
    console.warn('control-link sync failed', e)
  })
}

export type ControlSelection = { clientId: string; objectId: string }

export function loadControlSelection(): ControlSelection | null {
  try {
    const raw = localStorage.getItem(SELECT_KEY)
    if (raw) return JSON.parse(raw) as ControlSelection
  } catch {
    /* ignore */
  }
  return null
}

export function saveControlSelection(sel: ControlSelection | null) {
  if (!sel) localStorage.removeItem(SELECT_KEY)
  else localStorage.setItem(SELECT_KEY, JSON.stringify(sel))
}

export function loadAllReports(): ObjectDailyReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY)
    if (raw) return JSON.parse(raw) as ObjectDailyReport[]
  } catch {
    /* ignore */
  }
  return []
}

function saveAllReports(list: ObjectDailyReport[]) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(list))
}

function mergeReports(
  local: ObjectDailyReport[],
  remote: ObjectDailyReport[],
): ObjectDailyReport[] {
  const map = new Map<string, ObjectDailyReport>()
  for (const r of local) map.set(`${r.token}|${r.date}`, r)
  for (const r of remote) {
    const key = `${r.token}|${r.date}`
    const prev = map.get(key)
    if (!prev || Date.parse(r.createdAt) >= Date.parse(prev.createdAt)) {
      map.set(key, r)
    }
  }
  return [...map.values()]
}

export function getReportsForToken(token: string): ObjectDailyReport[] {
  return loadAllReports().filter((r) => r.token === token)
}

/** Локально + при API — подтянуть remote и смержить в localStorage. */
export async function hydrateReportsForToken(token: string): Promise<ObjectDailyReport[]> {
  const local = getReportsForToken(token)
  if (!isObjectReportsApiConfigured()) return local
  try {
    const remote = await fetchObjectReportsRemote(token)
    const merged = mergeReports(local, remote)
    const others = loadAllReports().filter((r) => r.token !== token)
    saveAllReports([...others, ...merged.filter((r) => r.token === token)])
    return merged.filter((r) => r.token === token)
  } catch (e) {
    console.warn('hydrate object-reports failed', e)
    return local
  }
}

export function getReportForDate(token: string, date: string): ObjectDailyReport | undefined {
  return getReportsForToken(token).find((r) => r.date === date)
}

export function datesWithReports(token: string): Set<string> {
  return new Set(getReportsForToken(token).map((r) => r.date))
}

export function saveDailyReport(
  report: Omit<ObjectDailyReport, 'id' | 'createdAt'> & { id?: string },
): ObjectDailyReport {
  const list = loadAllReports()
  const existingIdx = list.findIndex((r) => r.token === report.token && r.date === report.date)
  const row: ObjectDailyReport = {
    id: report.id ?? `rep-${Date.now()}`,
    token: report.token,
    date: report.date || todayIso(),
    workDone: report.workDone,
    problems: report.problems,
    workerName: report.workerName || '',
    media: report.media,
    createdAt: new Date().toISOString(),
  }
  if (existingIdx >= 0) {
    row.id = list[existingIdx].id
    list[existingIdx] = row
  } else {
    list.push(row)
  }
  saveAllReports(list)
  if (isObjectReportsApiConfigured()) {
    void postObjectReportRemote(row).catch((e) => {
      console.warn('object-report sync failed', e)
    })
  }
  return row
}

/** Сохранить локально и дождаться API (для публичной формы). */
export async function saveDailyReportAsync(
  report: Omit<ObjectDailyReport, 'id' | 'createdAt'> & { id?: string },
): Promise<{ row: ObjectDailyReport; synced: boolean; error?: string }> {
  const row = saveDailyReport(report)
  if (!isObjectReportsApiConfigured()) {
    return { row, synced: false }
  }
  try {
    const remote = await postObjectReportRemote(row)
    return { row: remote ?? row, synced: true }
  } catch (e) {
    return {
      row,
      synced: false,
      error: e instanceof Error ? e.message : 'sync error',
    }
  }
}

export function resolveControlLink(token: string): ControlLink | null {
  const list = loadLinks()
  const found = list.find((l) => l.token === token)
  if (found) return found
  return {
    token,
    clientId: '',
    objectId: '',
    objectTitle: 'Объект',
    objectAddress: 'Адрес уточняется',
  }
}

/** Локально + remote (если API настроен). */
export async function resolveControlLinkAsync(token: string): Promise<ControlLink> {
  const local = loadLinks().find((l) => l.token === token)
  if (local) return local
  if (isObjectReportsApiConfigured()) {
    try {
      const remote = await fetchControlLinkRemote(token)
      if (remote) {
        const list = loadLinks()
        if (!list.some((l) => l.token === remote.token)) {
          list.push(remote)
          saveLinks(list)
        }
        return remote
      }
    } catch (e) {
      console.warn('resolve control-link failed', e)
    }
  }
  return (
    resolveControlLink(token) ?? {
      token,
      clientId: '',
      objectId: '',
      objectTitle: 'Объект',
      objectAddress: 'Адрес уточняется',
    }
  )
}

export { todayIso }
