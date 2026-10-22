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
  media: ReportMediaMeta[]
  createdAt: string
}

export type ControlLink = {
  token: string
  objectTitle: string
  objectAddress: string
}

const LINK_KEY = 'samostroy:control_link_v1'
const REPORTS_KEY = 'samostroy:object_reports_v1'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getOrCreateControlLink(): ControlLink {
  try {
    const raw = localStorage.getItem(LINK_KEY)
    if (raw) return JSON.parse(raw) as ControlLink
  } catch {
    /* ignore */
  }
  const link: ControlLink = {
    token: `ctrl-${Math.random().toString(36).slice(2, 10)}`,
    objectTitle: 'Демо-объект',
    objectAddress: 'ул. Примерная, 1',
  }
  localStorage.setItem(LINK_KEY, JSON.stringify(link))
  return link
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
  const link = getOrCreateControlLink()
  if (link.token === token) return link
  // чужой/старый токен — всё равно даём заполнять отчёт (демо)
  return {
    token,
    objectTitle: 'Объект',
    objectAddress: 'Адрес уточняется',
  }
}

export { todayIso }
