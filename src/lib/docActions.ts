/**
 * Открытие мастера по записи реестра + повторная генерация PDF
 * из сохранённых полей (без нового №).
 */

import { getCalcVersion } from './calcVersions'
import { emptyClient, loadClients, type ClientCard } from './clients'
import { CONTRACTOR } from './contractor'
import type { DesignTariffId } from './designTariffs'
import {
  getIssuedDoc,
  isStandaloneSmeta,
  markDocIssued,
  type IssuedDoc,
  type IssuedDocKind,
} from './docRegistry'
import {
  generateAktDoc,
  generateDesignDoc,
  generateRemontDoc,
  generateSmetaDoc,
  generateTzStubDoc,
} from './generateDocs'

export function wizardHrefForDoc(doc: IssuedDoc): string | null {
  switch (doc.kind) {
    case 'design':
      return `/documents/design?docId=${encodeURIComponent(doc.id)}`
    case 'repair':
      return `/documents/repair?docId=${encodeURIComponent(doc.id)}`
    case 'act':
      return `/documents/acts?docId=${encodeURIComponent(doc.id)}`
    case 'smeta': {
      if (isStandaloneSmeta(doc)) {
        return `/documents/smeta?docId=${encodeURIComponent(doc.id)}`
      }
      const parentId = doc.parentContractId
      if (parentId) {
        return `/documents/repair?docId=${encodeURIComponent(parentId)}`
      }
      return `/documents/smeta?docId=${encodeURIComponent(doc.id)}`
    }
    case 'tz': {
      const parentId = doc.parentContractId
      if (parentId) {
        return `/documents/repair?docId=${encodeURIComponent(parentId)}`
      }
      return `/documents/repair?docId=${encodeURIComponent(doc.id)}`
    }
    case 'furniture':
      return `/documents/furniture?docId=${encodeURIComponent(doc.id)}`
    default:
      return null
  }
}

function clientOf(doc: IssuedDoc): ClientCard | undefined {
  if (!doc.clientId || doc.clientId.startsWith('__')) return undefined
  return loadClients().find((c) => c.id === doc.clientId)
}

/** Клиент для PDF: из КК или заглушка (смета без ФИО). */
function clientForPdf(doc: IssuedDoc): ClientCard {
  return (
    clientOf(doc) ??
    emptyClient({
      id: 'anon',
      name: 'Заказчик не указан',
      city: doc.city || 'Москва',
      address: doc.objectAddress || '',
    })
  )
}

function designTariffId(doc: IssuedDoc): DesignTariffId {
  const t = doc.tariffId
  return t === 'standard' || t === 'full' || t === 'max' ? t : 'full'
}

function smetaLinesOf(doc: IssuedDoc) {
  const ver = doc.calcVersionId ? getCalcVersion(doc.calcVersionId) : undefined
  if (ver?.lines?.length) {
    return ver.lines.map((l) => ({
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      price: l.price,
      section: l.section || 'Прочее',
    }))
  }
  return (doc.actLines ?? []).map((l) => ({
    name: l.name,
    unit: l.unit,
    qty: l.qty,
    price: l.price,
    section: l.section || 'Прочее',
  }))
}

/** Пересобрать PDF из текущих полей записи реестра (как при выпуске). */
export async function downloadIssuedDocPdf(doc: IssuedDoc): Promise<void> {
  const client = clientForPdf(doc)
  const date = doc.docDate || doc.updatedAt.slice(0, 10)
  const city = doc.city || client.city || 'Москва'
  const addr = doc.objectAddress || ''
  const number =
    doc.kind === 'act'
      ? String(doc.actStageNumber ?? doc.contractNumber ?? '')
      : doc.contractNumber || ''

  if (doc.kind === 'design') {
    const tariffId = designTariffId(doc)
    await generateDesignDoc(client, {
      number,
      date,
      city,
      objectAddress: addr,
      areaM2: doc.areaM2 || 0,
      executorName: CONTRACTOR.name,
      tariffId,
    })
    markDocIssued(doc.id)
    return
  }

  if (doc.kind === 'repair') {
    const ver = doc.calcVersionId ? getCalcVersion(doc.calcVersionId) : undefined
    const lines = (ver?.lines ?? doc.actLines ?? []).map((l) => ({
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      price: l.price,
      section: l.section,
    }))
    await generateRemontDoc(client, {
      number,
      date,
      city,
      objectAddress: addr,
      areaM2: doc.areaM2 || 0,
      totalSum: doc.total ?? ver?.total ?? 0,
      workDays: doc.workDays ?? 80,
      executorName: CONTRACTOR.name,
      discountPct: doc.discountPct ?? ver?.discountPct,
      baseTotal: doc.baseTotal ?? ver?.baseTotal,
      smetaLines: lines,
    })
    markDocIssued(doc.id)
    return
  }

  if (doc.kind === 'smeta') {
    const ver = doc.calcVersionId ? getCalcVersion(doc.calcVersionId) : undefined
    const lines = smetaLinesOf(doc)
    if (!lines.length) throw new Error('В смете нет сохранённых строк')
    await generateSmetaDoc(client, {
      number,
      date,
      city,
      objectAddress: addr,
      objectTitle: doc.objectTitle || '',
      areaM2: doc.areaM2 || 0,
      workDays: doc.workDays ?? 80,
      discountPct: doc.discountPct ?? ver?.discountPct ?? 0,
      rolledUp: false,
      lines,
      executorName: CONTRACTOR.name,
    })
    markDocIssued(doc.id)
    return
  }

  if (doc.kind === 'tz') {
    await generateTzStubDoc(client, {
      number,
      date,
      city,
      objectAddress: addr,
      contractNumber: doc.contractNumber || number,
      executorName: CONTRACTOR.name,
    })
    markDocIssued(doc.id)
    return
  }

  if (doc.kind === 'act') {
    const lines = (doc.actLines ?? []).map((l) => ({
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      price: l.price,
      section: l.section || 'Прочее',
    }))
    if (!lines.length) throw new Error('В акте нет сохранённых строк работ')
    await generateAktDoc(client, {
      number,
      date,
      city,
      objectAddress: addr,
      stageName: doc.stageName || `Этап ${doc.actStageNumber ?? ''}`,
      paid: doc.paid ?? 0,
      executorName: CONTRACTOR.name,
      contractNumber: doc.contractNumber,
      lines,
    })
    markDocIssued(doc.id)
    return
  }

  throw new Error('Для этого типа документа PDF пока недоступен')
}

export async function downloadIssuedDocPdfById(id: string): Promise<void> {
  const doc = getIssuedDoc(id)
  if (!doc) throw new Error('Документ не найден')
  await downloadIssuedDocPdf(doc)
}

export function kindSupportsWizard(kind: IssuedDocKind): boolean {
  return (
    kind === 'design' ||
    kind === 'repair' ||
    kind === 'act' ||
    kind === 'smeta' ||
    kind === 'tz' ||
    kind === 'furniture'
  )
}
