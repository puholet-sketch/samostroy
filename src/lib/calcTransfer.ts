/** Смета → договор на ремонт: флаги и снимок строк из калькулятора */

export type CalcSmetaLine = {
  name: string
  unit: string
  qty: number
  price: number
  /** Раздел калькулятора (для группировки в смете / приложении) */
  section?: string
  /** Черновые / чистовые (если задано в прайсе) */
  kind?: 'chernovye' | 'chistovye' | 'both'
}

export type CalcTransferState = {
  transferToRemont: boolean
  withDetails: boolean
  total: number
  /** База до скидки (сумма строк) */
  baseTotal: number
  /** Скидка, % — задаётся в калькуляторе */
  discountPct: number
  /** Итог после скидки (= total) */
  lines: CalcSmetaLine[]
  updatedAt: string
}

const KEY = 'samostroy:calc_transfer_v1'

export function loadCalcTransfer(): CalcTransferState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CalcTransferState>
      const baseTotal = Number(parsed.baseTotal ?? parsed.total) || 0
      const discountPct = Math.max(0, Math.min(100, Number(parsed.discountPct) || 0))
      const total =
        Number(parsed.total) ||
        Math.round((baseTotal * (1 - discountPct / 100)) * 100) / 100
      return {
        transferToRemont: Boolean(parsed.transferToRemont),
        withDetails: Boolean(parsed.withDetails),
        total,
        baseTotal,
        discountPct,
        lines: Array.isArray(parsed.lines) ? (parsed.lines as CalcSmetaLine[]) : [],
        updatedAt: parsed.updatedAt || '',
      }
    }
  } catch {
    /* ignore */
  }
  return {
    transferToRemont: false,
    withDetails: false,
    total: 0,
    baseTotal: 0,
    discountPct: 0,
    lines: [],
    updatedAt: '',
  }
}

export function saveCalcTransfer(state: CalcTransferState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function applyDiscount(baseTotal: number, discountPct: number): {
  discountPct: number
  discountSum: number
  total: number
} {
  const pct = Math.max(0, Math.min(100, Number(discountPct) || 0))
  const discountSum = Math.round(baseTotal * (pct / 100) * 100) / 100
  const total = Math.round((baseTotal - discountSum) * 100) / 100
  return { discountPct: pct, discountSum, total }
}

export function buildLinesFromQty(
  items: {
    name: string
    unit: string
    price: number
    section: string
    kind?: 'chernovye' | 'chistovye' | 'both'
  }[],
  qty: Record<string, number>,
  itemKey: (
    it: {
      name: string
      unit: string
      price: number
      section: string
      kind?: 'chernovye' | 'chistovye' | 'both'
    },
    idx: number,
  ) => string,
): { lines: CalcSmetaLine[]; total: number } {
  const lines: CalcSmetaLine[] = []
  let total = 0
  items.forEach((it, idx) => {
    const n = Number(qty[itemKey(it, idx)]) || 0
    if (n > 0) {
      lines.push({
        name: it.name,
        unit: it.unit,
        qty: n,
        price: it.price,
        section: it.section || 'Прочее',
        kind: it.kind,
      })
      total += n * it.price
    }
  })
  return { lines, total }
}
