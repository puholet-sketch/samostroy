/** Версии расчёта по объекту: несколько снимков, одна — согласованная. */

import type { CalcSmetaLine } from './calcTransfer'
import { applyDiscount, loadCalcTransfer } from './calcTransfer'

export type CalcVersion = {
  id: string
  clientId: string
  objectId: string
  label: string
  /** После подтверждения клиентом (скидка / состав работ) */
  agreed: boolean
  discountPct: number
  baseTotal: number
  total: number
  lines: CalcSmetaLine[]
  createdAt: string
  updatedAt: string
}

const KEY = 'samostroy:calc_versions_v1'

function loadAll(): CalcVersion[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const list = JSON.parse(raw) as CalcVersion[]
      if (Array.isArray(list)) return list
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveAll(list: CalcVersion[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function listCalcVersions(clientId: string, objectId: string): CalcVersion[] {
  return loadAll()
    .filter((v) => v.clientId === clientId && v.objectId === objectId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function getAgreedCalcVersion(
  clientId: string,
  objectId: string,
): CalcVersion | undefined {
  return listCalcVersions(clientId, objectId).find((v) => v.agreed)
}

/** Сохранить текущий calcTransfer как новую (или обновлённую) версию. */
export function saveCalcVersionFromTransfer(opts: {
  clientId: string
  objectId: string
  label?: string
  id?: string
}): CalcVersion {
  const t = loadCalcTransfer()
  const now = new Date().toISOString()
  const list = loadAll()
  const existingIdx = opts.id ? list.findIndex((v) => v.id === opts.id) : -1
  const { discountPct, total } = applyDiscount(t.baseTotal || t.total, t.discountPct)
  const row: CalcVersion = {
    id: opts.id ?? `cv-${Date.now()}`,
    clientId: opts.clientId,
    objectId: opts.objectId,
    label: opts.label?.trim() || `Версия ${new Date().toLocaleString('ru-RU')}`,
    agreed: existingIdx >= 0 ? list[existingIdx].agreed : false,
    discountPct,
    baseTotal: t.baseTotal || t.total,
    total,
    lines: t.lines,
    createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : now,
    updatedAt: now,
  }
  if (existingIdx >= 0) list[existingIdx] = row
  else list.unshift(row)
  saveAll(list)
  return row
}

/** Пометить версию согласованной (с остальных того же объекта снять флаг). */
export function agreeCalcVersion(id: string): CalcVersion | null {
  const list = loadAll()
  const target = list.find((v) => v.id === id)
  if (!target) return null
  const now = new Date().toISOString()
  const next = list.map((v) => {
    if (v.clientId !== target.clientId || v.objectId !== target.objectId) return v
    if (v.id === id) return { ...v, agreed: true, updatedAt: now }
    return { ...v, agreed: false }
  })
  saveAll(next)
  return next.find((v) => v.id === id) ?? null
}
