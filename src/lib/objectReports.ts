/** Публичные отчёты по объекту (токен ссылки → отчёты по датам).
 * Локально: localStorage. При настроенном Feedback/API URL — ещё и Postgres через REST.
 */

import { getMediaBlob, putMediaBlob } from './mediaStore'
import {
  fetchControlLinkRemote,
  fetchObjectReportsRemote,
  fetchReportMediaRemote,
  isObjectReportsApiConfigured,
  postControlLinkRemote,
  postObjectReportRemote,
  uploadReportMediaRemote,
} from './objectReportsApi'

export type ReportMediaMeta = {
  id: string
  name: string
  mime: string
  size: number
  kind: 'image' | 'video' | 'file'
  /** Уже залито на API (для sync между устройствами) */
  remote?: boolean
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

/** CustomEvent: календарь контроля / форма перечитывают localStorage. */
export const REPORTS_CHANGED_EVENT = 'samostroy:object-reports-changed'

function notifyReportsChanged(token?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(REPORTS_CHANGED_EVENT, { detail: { token: token ?? '' } }),
  )
}

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

function reportRichness(r: ObjectDailyReport): number {
  return (
    (r.workDone?.trim().length || 0) +
    (r.problems?.trim().length || 0) +
    (r.workerName?.trim().length || 0) +
    (r.media?.length || 0) * 10
  )
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
    if (!prev) {
      map.set(key, r)
      continue
    }
    const remoteTs = Date.parse(r.createdAt) || 0
    const localTs = Date.parse(prev.createdAt) || 0
    // Не затирать более полный локальный отчёт «пустым» remote
    if (reportRichness(r) === 0 && reportRichness(prev) > 0) continue
    if (remoteTs > localTs) map.set(key, r)
    else if (remoteTs === localTs && reportRichness(r) > reportRichness(prev)) {
      map.set(key, r)
    } else if (remoteTs < localTs) {
      // keep local (newer save)
    } else {
      // same age: prefer richer
      if (reportRichness(r) >= reportRichness(prev)) map.set(key, r)
    }
  }
  return [...map.values()]
}

export function getReportsForToken(token: string): ObjectDailyReport[] {
  return loadAllReports().filter((r) => r.token === token)
}

async function hydrateMediaBlobs(reports: ObjectDailyReport[]): Promise<void> {
  if (!isObjectReportsApiConfigured()) return
  for (const r of reports) {
    for (const m of r.media ?? []) {
      if (!m.remote && !m.id) continue
      try {
        const existing = await getMediaBlob(m.id)
        if (existing) continue
        const blob = await fetchReportMediaRemote(m.id)
        if (blob) await putMediaBlob(m.id, blob)
      } catch (e) {
        console.warn('media hydrate failed', m.id, e)
      }
    }
  }
}

/** Локально + при API — подтянуть remote и смержить в localStorage. */
export async function hydrateReportsForToken(token: string): Promise<ObjectDailyReport[]> {
  const local = getReportsForToken(token)
  if (!isObjectReportsApiConfigured()) return local
  try {
    const remote = await fetchObjectReportsRemote(token)
    const merged = mergeReports(local, remote)
    const others = loadAllReports().filter((r) => r.token !== token)
    const forToken = merged.filter((r) => r.token === token)
    saveAllReports([...others, ...forToken])
    notifyReportsChanged(token)
    void hydrateMediaBlobs(forToken)
    return forToken
  } catch (e) {
    console.warn('hydrate object-reports failed', e)
    return local
  }
}

export function getReportForDate(token: string, date: string): ObjectDailyReport | undefined {
  return getReportsForToken(token).find((r) => r.date === date)
}

export function datesWithReports(token: string): Set<string> {
  return new Set(
    getReportsForToken(token)
      .filter((r) => (r.workDone?.trim() || r.workerName?.trim() || (r.media?.length ?? 0) > 0))
      .map((r) => r.date),
  )
}

/** Только localStorage — без fire-and-forget API (API делает saveDailyReportAsync). */
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
  notifyReportsChanged(row.token)
  return row
}

async function syncMediaForReport(
  media: ReportMediaMeta[],
): Promise<ReportMediaMeta[]> {
  if (!isObjectReportsApiConfigured() || media.length === 0) return media
  const out: ReportMediaMeta[] = []
  for (const m of media) {
    if (m.remote) {
      out.push(m)
      continue
    }
    try {
      const blob = await getMediaBlob(m.id)
      if (!blob) {
        out.push(m)
        continue
      }
      await uploadReportMediaRemote(m, blob)
      out.push({ ...m, remote: true })
    } catch (e) {
      console.warn('media upload failed', m.id, e)
      out.push(m)
    }
  }
  return out
}

/** Сохранить локально сразу; API — с таймаутом. UI никогда не должен висеть бесконечно. */
export async function saveDailyReportAsync(
  report: Omit<ObjectDailyReport, 'id' | 'createdAt'> & { id?: string },
): Promise<{ row: ObjectDailyReport; synced: boolean; error?: string }> {
  // 1) всегда локально (календарь контроля увидит сразу)
  let row = saveDailyReport(report)

  if (!isObjectReportsApiConfigured()) {
    return { row, synced: false }
  }

  try {
    const media = await syncMediaForReport(row.media)
    if (media.some((m, i) => m.remote !== row.media[i]?.remote)) {
      row = saveDailyReport({ ...row, media })
    }
    const remote = await postObjectReportRemote(row)
    // зафиксировать ответ API в local (id/media), не теряя локальную полноту
    const merged = mergeReports([row], [remote])[0] ?? row
    const list = loadAllReports()
    const idx = list.findIndex((r) => r.token === merged.token && r.date === merged.date)
    if (idx >= 0) list[idx] = { ...merged, media: row.media }
    else list.push({ ...merged, media: row.media })
    saveAllReports(list)
    notifyReportsChanged(row.token)
    return { row: { ...merged, media: row.media }, synced: true }
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
