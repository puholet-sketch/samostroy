/**
 * Реестр выданных документов + сквозной нумератор договоров
 * (дизайн / ремонт / мебелировка). Акты — по этапам 1…N на договор.
 */

export type ContractDocKind = 'design' | 'repair' | 'furniture'
export type IssuedDocKind = ContractDocKind | 'act' | 'tz' | 'smeta'

export type DesignTariffId = 'standard' | 'full' | 'max'

export type IssuedDoc = {
  id: string
  kind: IssuedDocKind
  /** Сквозной № договора (design/repair/furniture) */
  contractNumber?: string
  /** Номер акта по этапам работ: 1…N */
  actStageNumber?: number
  clientId: string
  objectId: string
  title: string
  status: 'draft' | 'issued' | 'agreed'
  tariffId?: DesignTariffId
  ratePerM2?: number
  excludedClauses?: string[]
  calcVersionId?: string
  plannedStartDate?: string
  total?: number
  areaM2?: number
  city?: string
  objectAddress?: string
  /** Для актов / ТЗ — родительский договор ремонта */
  parentContractId?: string
  /** Снимок выбранных строк акта */
  actLines?: {
    name: string
    unit: string
    qty: number
    price: number
    section?: string
  }[]
  stageName?: string
  createdAt: string
  updatedAt: string
}

const DOCS_KEY = 'samostroy:issued_docs_v1'
const COUNTER_KEY = 'samostroy:contract_counter_v1'

function loadAll(): IssuedDoc[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY)
    if (raw) {
      const list = JSON.parse(raw) as IssuedDoc[]
      if (Array.isArray(list)) return list
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveAll(list: IssuedDoc[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(list))
}

export function listIssuedDocs(filter?: {
  kind?: IssuedDocKind | IssuedDocKind[]
  clientId?: string
  objectId?: string
  status?: IssuedDoc['status']
  q?: string
}): IssuedDoc[] {
  let list = loadAll()
  if (filter?.kind) {
    const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind]
    list = list.filter((d) => kinds.includes(d.kind))
  }
  if (filter?.clientId) list = list.filter((d) => d.clientId === filter.clientId)
  if (filter?.objectId) list = list.filter((d) => d.objectId === filter.objectId)
  if (filter?.status) list = list.filter((d) => d.status === filter.status)
  if (filter?.q?.trim()) {
    const s = filter.q.trim().toLowerCase()
    list = list.filter((d) =>
      [d.title, d.contractNumber, d.objectAddress, d.stageName, d.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(s),
    )
  }
  return list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function getIssuedDoc(id: string): IssuedDoc | undefined {
  return loadAll().find((d) => d.id === id)
}

/** Текущее значение счётчика (последний выданный №). */
export function peekContractCounter(): number {
  try {
    const n = Number(localStorage.getItem(COUNTER_KEY) || '0')
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/**
 * Выделить следующий сквозной номер договора (дизайн / ремонт / мебель).
 * Возвращает строку «N» (N+1 от счётчика).
 */
export function allocateContractNumber(): string {
  const next = peekContractCounter() + 1
  localStorage.setItem(COUNTER_KEY, String(next))
  return String(next)
}

export function upsertIssuedDoc(
  partial: Omit<IssuedDoc, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string
    createdAt?: string
  },
): IssuedDoc {
  const now = new Date().toISOString()
  const list = loadAll()
  const id = partial.id ?? `doc-${Date.now()}`
  const idx = list.findIndex((d) => d.id === id)
  const row: IssuedDoc = {
    ...partial,
    id,
    createdAt: idx >= 0 ? list[idx].createdAt : partial.createdAt ?? now,
    updatedAt: now,
  }
  if (idx >= 0) list[idx] = { ...list[idx], ...row, createdAt: list[idx].createdAt, updatedAt: now }
  else list.unshift(row)
  saveAll(list)
  return list.find((d) => d.id === id)!
}

export function updateIssuedDoc(
  id: string,
  patch: Partial<IssuedDoc>,
): IssuedDoc | null {
  const list = loadAll()
  const idx = list.findIndex((d) => d.id === id)
  if (idx < 0) return null
  list[idx] = {
    ...list[idx],
    ...patch,
    id,
    createdAt: list[idx].createdAt,
    updatedAt: new Date().toISOString(),
  }
  saveAll(list)
  return list[idx]
}

export function deleteIssuedDoc(id: string): boolean {
  const list = loadAll()
  const next = list.filter((d) => d.id !== id)
  if (next.length === list.length) return false
  saveAll(next)
  return true
}

/** Согласованные договоры ремонта (для актов). */
export function listAgreedRepairContracts(clientId?: string, objectId?: string): IssuedDoc[] {
  return listIssuedDocs({
    kind: 'repair',
    status: 'agreed',
    clientId,
    objectId,
  })
}

/** Следующий номер акта по этапам для договора: 1…N */
export function nextActStageNumber(parentContractId: string): number {
  const acts = listIssuedDocs({ kind: 'act' }).filter(
    (d) => d.parentContractId === parentContractId,
  )
  const used = acts.map((a) => a.actStageNumber ?? 0)
  const max = used.length ? Math.max(...used) : 0
  return max + 1
}

export function kindLabel(kind: IssuedDocKind): string {
  switch (kind) {
    case 'design':
      return 'Договор дизайна'
    case 'repair':
      return 'Договор ремонта'
    case 'furniture':
      return 'Договор мебелировки'
    case 'act':
      return 'Акт'
    case 'tz':
      return 'ТЗ'
    case 'smeta':
      return 'Смета'
    default:
      return kind
  }
}

export function statusLabel(status: IssuedDoc['status']): string {
  switch (status) {
    case 'draft':
      return 'черновик'
    case 'issued':
      return 'выдан'
    case 'agreed':
      return 'согласованный'
    default:
      return status
  }
}
