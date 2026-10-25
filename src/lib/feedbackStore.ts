import { deleteMediaBlob, getMediaBlob, putMediaBlob } from './mediaStore'

const STORAGE_KEY = 'samostroy:feedback_v1'

export type FeedbackKind = 'ux' | 'bug' | 'idea'
export type FeedbackStatus = 'new' | 'in_progress' | 'done'
export type FeedbackSyncStatus = 'local' | 'synced' | 'pending' | 'error'
export type FeedbackMarkerType = 'rect' | 'pin' | 'arrow' | 'text'

/** Координаты в процентах от размера кадра (0–100). */
export type FeedbackMarker = {
  id: string
  type: FeedbackMarkerType
  x: number
  y: number
  w?: number
  h?: number
  /** Для стрелки — конец */
  x2?: number
  y2?: number
  label: string
  note?: string
}

export type FeedbackItem = {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  body: string
  kind: FeedbackKind
  status: FeedbackStatus
  authorId: string
  authorName: string
  authorRole: string
  route: string
  pageTitle: string
  buildStamp: string
  markers: FeedbackMarker[]
  imageId: string
  tgMessageId?: number
  syncStatus: FeedbackSyncStatus
  syncError?: string
  /** Email через Web3Forms: sent | error | skipped (канал не настроен) */
  emailStatus?: 'sent' | 'error' | 'skipped'
  emailAttached?: boolean
  emailError?: string
}

function loadAll(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FeedbackItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(list: FeedbackItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function listFeedback(): FeedbackItem[] {
  return loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function countOpenFeedback(): number {
  return loadAll().filter((f) => f.status === 'new').length
}

export function getFeedback(id: string): FeedbackItem | null {
  return loadAll().find((f) => f.id === id) ?? null
}

export function upsertFeedback(item: FeedbackItem): void {
  const list = loadAll()
  const i = list.findIndex((x) => x.id === item.id)
  if (i >= 0) list[i] = item
  else list.unshift(item)
  saveAll(list)
}

export function updateFeedbackStatus(id: string, status: FeedbackStatus): FeedbackItem | null {
  const list = loadAll()
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return null
  list[i] = { ...list[i], status, updatedAt: new Date().toISOString() }
  saveAll(list)
  return list[i]
}

export function mergeRemoteFeedback(remote: FeedbackItem[]): void {
  const local = loadAll()
  const byId = new Map(local.map((x) => [x.id, x]))
  for (const r of remote) {
    const prev = byId.get(r.id)
    if (!prev) {
      byId.set(r.id, { ...r, syncStatus: 'synced' })
      continue
    }
    const remoteNewer = r.updatedAt > prev.updatedAt
    byId.set(r.id, {
      ...prev,
      ...r,
      imageId: prev.imageId || r.imageId,
      syncStatus: 'synced',
      syncError: undefined,
      status: remoteNewer ? r.status : prev.status,
      updatedAt: remoteNewer ? r.updatedAt : prev.updatedAt,
    })
  }
  saveAll([...byId.values()])
}

export async function saveFeedbackImage(id: string, blob: Blob): Promise<void> {
  await putMediaBlob(id, blob)
}

export async function loadFeedbackImage(id: string): Promise<Blob | null> {
  return getMediaBlob(id)
}

export async function removeFeedbackImage(id: string): Promise<void> {
  await deleteMediaBlob(id)
}

/** Бриф для исполнителя (копируется владельцем из инбокса). */
export function executorBriefFor(item: FeedbackItem): string {
  const kindLabel = { ux: 'UX', bug: 'Баг', idea: 'Идея' }[item.kind]
  const markers =
    item.markers.length === 0
      ? '— без меток'
      : item.markers
          .map((m, i) => {
            const geo =
              m.type === 'rect'
                ? `rect ${m.x.toFixed(1)}%,${m.y.toFixed(1)}% ${m.w?.toFixed(1)}%×${m.h?.toFixed(1)}%`
                : m.type === 'arrow'
                  ? `arrow ${m.x.toFixed(1)}%,${m.y.toFixed(1)}% → ${m.x2?.toFixed(1)}%,${m.y2?.toFixed(1)}%`
                  : `${m.type} ${m.x.toFixed(1)}%,${m.y.toFixed(1)}%`
            return `${i + 1}. [${m.label}] ${geo}${m.note ? ` — ${m.note}` : ''}`
          })
          .join('\n')

  return [
    `Задача для разработки · СамоСтрой ${item.id}`,
    `Тема: ${item.title}`,
    `Тип: ${kindLabel}`,
    `Статус: ${item.status}`,
    `Страница: ${item.pageTitle} (${item.route})`,
    `Сборка: ${item.buildStamp}`,
    `Автор: ${item.authorName} (${item.authorRole})`,
    `Создано: ${item.createdAt}`,
    '',
    'Метки на скрине:',
    markers,
    '',
    'Описание:',
    item.body || '—',
    '',
    'Внеси правки в проекте samostroy по этому замечанию. Скрин с разметкой во вложении / в карточке замечания.',
  ].join('\n')
}

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Новое',
  in_progress: 'В работе',
  done: 'Сделано',
}

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  ux: 'UX',
  bug: 'Баг',
  idea: 'Идея',
}
