/** Смета → договор на ремонт: флаги и снимок строк из калькулятора */

export type CalcSmetaLine = {
  name: string
  unit: string
  qty: number
  price: number
}

export type CalcTransferState = {
  transferToRemont: boolean
  withDetails: boolean
  total: number
  lines: CalcSmetaLine[]
  updatedAt: string
}

const KEY = 'samostroy:calc_transfer_v1'

export function loadCalcTransfer(): CalcTransferState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as CalcTransferState
  } catch {
    /* ignore */
  }
  return {
    transferToRemont: false,
    withDetails: false,
    total: 0,
    lines: [],
    updatedAt: '',
  }
}

export function saveCalcTransfer(state: CalcTransferState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function buildLinesFromQty(
  items: { name: string; unit: string; price: number; section: string }[],
  qty: Record<string, number>,
  itemKey: (it: { name: string; unit: string; price: number; section: string }, idx: number) => string,
): { lines: CalcSmetaLine[]; total: number } {
  const lines: CalcSmetaLine[] = []
  let total = 0
  items.forEach((it, idx) => {
    const n = Number(qty[itemKey(it, idx)]) || 0
    if (n > 0) {
      lines.push({ name: it.name, unit: it.unit, qty: n, price: it.price })
      total += n * it.price
    }
  })
  return { lines, total }
}
