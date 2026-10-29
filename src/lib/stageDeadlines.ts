/**
 * Дедлайны этапов договора от даты старта объекта (startDate).
 * Дизайн — фиксированные рабочие дни из типового договора;
 * ремонт — 14 этапов пропорционально defaultPct шаблона.
 */

import stageTemplate from '../../data/stage_template.json'
import { loadClients, type ClientObject } from './clients'

export type StageDeadlineKind = 'design' | 'remont'

export type StageDeadline = {
  kind: StageDeadlineKind
  clientId: string
  clientName: string
  objectId: string
  objectTitle: string
  objectAddress: string
  startDate: string
  stageN: number
  stageName: string
  /** Календарная дата окончания этапа (рабочие дни → календ.) */
  dueDate: string
  workDaysOffset: number
}

/** Приближение: рабочие дни → календарные (+weekend). */
function addWorkDays(isoStart: string, workDays: number): string {
  const d = new Date(`${isoStart.slice(0, 10)}T12:00:00`)
  let left = Math.max(0, Math.floor(workDays))
  // если 0 — сам день старта
  if (left === 0) {
    return isoStart.slice(0, 10)
  }
  while (left > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) left -= 1
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Типовые этапы дизайн-договора (п. 3.2). */
const DESIGN_STAGES: { n: number; name: string; workDays: number }[] = [
  { n: 1, name: 'Обмерный план и планировочное решение', workDays: 10 },
  { n: 2, name: 'Визуализация интерьера', workDays: 20 },
  { n: 3, name: 'Рабочие чертежи', workDays: 15 },
  { n: 4, name: 'Ведомость чистового материала', workDays: 15 },
]

const REMONT_TOTAL_WORK_DAYS = 80

type TemplateStage = { n: number; name: string; defaultPct: number }

function remontStages(): TemplateStage[] {
  const stages = (stageTemplate as { stages: TemplateStage[] }).stages
  return Array.isArray(stages) ? stages : []
}

function objectLabel(o: ClientObject): string {
  return o.title || o.address || 'Объект'
}

/** Все дедлайны по объектам с заполненным startDate. */
export function listStageDeadlines(opts?: {
  onlyInWork?: boolean
  kinds?: StageDeadlineKind[]
}): StageDeadline[] {
  const onlyInWork = opts?.onlyInWork ?? true
  const kinds = new Set(opts?.kinds ?? (['design', 'remont'] as StageDeadlineKind[]))
  const out: StageDeadline[] = []
  const clients = loadClients()
  const rStages = remontStages()

  for (const c of clients) {
    for (const o of c.objects ?? []) {
      if (!o.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(o.startDate)) continue
      if (onlyInWork && !o.inWork) continue
      const title = objectLabel(o)
      const addr = o.address || o.title || ''

      if (kinds.has('design')) {
        let cum = 0
        for (const st of DESIGN_STAGES) {
          cum += st.workDays
          out.push({
            kind: 'design',
            clientId: c.id,
            clientName: c.name || '',
            objectId: o.id,
            objectTitle: title,
            objectAddress: addr,
            startDate: o.startDate,
            stageN: st.n,
            stageName: st.name,
            dueDate: addWorkDays(o.startDate, cum),
            workDaysOffset: cum,
          })
        }
      }

      if (kinds.has('remont') && rStages.length > 0) {
        let cum = 0
        for (const st of rStages) {
          const days = Math.max(
            1,
            Math.round((REMONT_TOTAL_WORK_DAYS * (st.defaultPct || 0)) / 100),
          )
          cum += days
          out.push({
            kind: 'remont',
            clientId: c.id,
            clientName: c.name || '',
            objectId: o.id,
            objectTitle: title,
            objectAddress: addr,
            startDate: o.startDate,
            stageN: st.n,
            stageName: st.name,
            dueDate: addWorkDays(o.startDate, cum),
            workDaysOffset: cum,
          })
        }
      }
    }
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.stageN - b.stageN)
}

export function deadlinesDueSoon(
  withinDays = 3,
  refIso = new Date().toISOString().slice(0, 10),
): StageDeadline[] {
  const ref = new Date(`${refIso}T12:00:00`)
  const end = new Date(ref)
  end.setDate(end.getDate() + withinDays)
  const endIso = end.toISOString().slice(0, 10)
  return listStageDeadlines().filter((d) => d.dueDate >= refIso && d.dueDate <= endIso)
}

export function formatDeadlineLine(d: StageDeadline): string {
  const kind = d.kind === 'design' ? 'дизайн' : 'ремонт'
  return `${d.dueDate} · ${kind} этап ${d.stageN} «${d.stageName}» · ${d.clientName || '—'} · ${d.objectAddress || d.objectTitle}`
}
