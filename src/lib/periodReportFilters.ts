/** Фильтры сводного отчёта (persist в localStorage). */

export type PeriodReportFilters = {
  clientId: string
  objectId: string
  /** '' | 'has' | 'missing' */
  reportPresence: '' | 'has' | 'missing'
  onlyInWork: boolean
}

const KEY = 'samostroy:period_report_filters_v1'

export const emptyPeriodFilters = (): PeriodReportFilters => ({
  clientId: '',
  objectId: '',
  reportPresence: '',
  onlyInWork: true,
})

export function loadPeriodFilters(): PeriodReportFilters {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<PeriodReportFilters>
      return {
        clientId: p.clientId || '',
        objectId: p.objectId || '',
        reportPresence:
          p.reportPresence === 'has' || p.reportPresence === 'missing'
            ? p.reportPresence
            : '',
        onlyInWork: Boolean(p.onlyInWork),
      }
    }
  } catch {
    /* ignore */
  }
  return emptyPeriodFilters()
}

export function savePeriodFilters(f: PeriodReportFilters) {
  localStorage.setItem(KEY, JSON.stringify(f))
}
