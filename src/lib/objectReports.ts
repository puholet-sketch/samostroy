/** Публичные отчёты по объекту (токен ссылки → отчёты по датам) */

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
  return link
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

export function getReportsForToken(token: string): ObjectDailyReport[] {
  return loadAllReports().filter((r) => r.token === token)
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
  return row
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

export { todayIso }
