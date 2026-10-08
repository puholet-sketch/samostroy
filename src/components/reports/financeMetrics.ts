import type { RenovationObject } from '../../services/types'

export type ObjectFinanceRow = {
  objectId: string
  title: string
  planned: number
  paid: number
  remaining: number
  actsClosed: number
  stagesTotal: number
  pctPaid: number
  pctActsClosed: number
}

export type FinanceSummary = {
  planned: number
  paid: number
  remaining: number
  actsClosed: number
  stagesTotal: number
  pctPaid: number
  pctActsClosed: number
  avgPaidPerClosedAct: number
  rows: ObjectFinanceRow[]
}

function isActClosed(s: { actSigned: boolean; status: string }): boolean {
  return s.actSigned || s.status === 'closed'
}

export function computeFinance(objects: RenovationObject[]): FinanceSummary {
  const rows: ObjectFinanceRow[] = objects.map((o) => {
    const planned = o.stages.reduce((a, s) => a + s.plannedAmount, 0)
    const paid = o.stages.reduce((a, s) => a + s.paidAmount, 0)
    const actsClosed = o.stages.filter(isActClosed).length
    const stagesTotal = o.stages.length
    return {
      objectId: o.id,
      title: o.title,
      planned,
      paid,
      remaining: Math.max(0, planned - paid),
      actsClosed,
      stagesTotal,
      pctPaid: planned > 0 ? (paid / planned) * 100 : 0,
      pctActsClosed: stagesTotal > 0 ? (actsClosed / stagesTotal) * 100 : 0,
    }
  })

  const planned = rows.reduce((a, r) => a + r.planned, 0)
  const paid = rows.reduce((a, r) => a + r.paid, 0)
  const actsClosed = rows.reduce((a, r) => a + r.actsClosed, 0)
  const stagesTotal = rows.reduce((a, r) => a + r.stagesTotal, 0)

  return {
    planned,
    paid,
    remaining: Math.max(0, planned - paid),
    actsClosed,
    stagesTotal,
    pctPaid: planned > 0 ? (paid / planned) * 100 : 0,
    pctActsClosed: stagesTotal > 0 ? (actsClosed / stagesTotal) * 100 : 0,
    avgPaidPerClosedAct: actsClosed > 0 ? paid / actsClosed : 0,
    rows,
  }
}

export function formatRub(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}
