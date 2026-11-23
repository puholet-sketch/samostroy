/**
 * Открытие мастера по записи реестра + повторная генерация PDF
 * из сохранённых полей (без нового №).
 */

import { getCalcVersion } from './calcVersions'
import { loadClients, type ClientCard } from './clients'
import { CONTRACTOR } from './contractor'
import type { DesignTariffId } from './designTariffs'
import {
  getIssuedDoc,
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
    case 'smeta':
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
  return loadClients().find((c) => c.id === doc.clientId)
}

function designTariffId(doc: IssuedDoc): DesignTariffId {
  const t = doc.tariffId
  return t === 'standard' || t === 'full' || t === 'max' ? t : 'full'
}

/** Пересобрать PDF из текущих полей записи реестра (как при выпуске). */
export async function downloadIssuedDocPdf(doc: IssuedDoc): Promise<void> {
  const client = clientOf(doc)
  if (!client) throw new Error('Клиент не найден')

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
    return
  }

  if (doc.kind === 'repair') {
    const ver = doc.calcVersionId ? getCalcVersion(doc.calcVersionId) : undefined
    const lines = (ver?.lines ?? []).map((l) => ({
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
    return
  }

  if (doc.kind === 'smeta') {
    const ver = doc.calcVersionId ? getCalcVersion(doc.calcVersionId) : undefined
    const lines = (ver?.lines ?? []).map((l) => ({
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      price: l.price,
      section: l.section || 'Прочее',
    }))
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
