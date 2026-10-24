import { isFeedbackApiConfigured, loadFeedbackApiConfig } from './feedbackConfig'
import type { FeedbackItem, FeedbackStatus } from './feedbackStore'
import { upsertFeedback } from './feedbackStore'

function headers(token: string, extra?: HeadersInit): HeadersInit {
  return { 'X-Feedback-Token': token, ...(extra ?? {}) }
}

export async function fetchFeedbackList(): Promise<FeedbackItem[]> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return []
  const res = await fetch(`${cfg.baseUrl}/api/feedback`, {
    headers: headers(cfg.token),
  })
  if (!res.ok) throw new Error(`GET feedback ${res.status}`)
  const data = (await res.json()) as FeedbackItem[]
  return Array.isArray(data) ? data : []
}

export async function patchFeedbackStatusRemote(
  id: string,
  status: FeedbackStatus,
): Promise<void> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return
  const res = await fetch(`${cfg.baseUrl}/api/feedback/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(cfg.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`PATCH feedback ${res.status}`)
}

export async function postFeedbackRemote(
  item: FeedbackItem,
  imageBlob: Blob,
): Promise<{ tgMessageId?: number }> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) {
    throw new Error('Feedback API не настроен')
  }
  const fd = new FormData()
  const meta = { ...item }
  delete (meta as { imageBlob?: unknown }).imageBlob
  fd.append('meta', JSON.stringify(meta))
  fd.append('image', imageBlob, `${item.id}.png`)

  const res = await fetch(`${cfg.baseUrl}/api/feedback`, {
    method: 'POST',
    headers: headers(cfg.token),
    body: fd,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST feedback ${res.status}${text ? `: ${text}` : ''}`)
  }
  const data = (await res.json()) as { id?: string; tgMessageId?: number }
  return { tgMessageId: data.tgMessageId }
}

/** Сохранить локально и попытаться отправить на API. */
export async function submitFeedbackWithSync(
  item: FeedbackItem,
  imageBlob: Blob,
): Promise<FeedbackItem> {
  let next: FeedbackItem = { ...item, syncStatus: 'pending' }
  upsertFeedback(next)
  try {
    const { tgMessageId } = await postFeedbackRemote(next, imageBlob)
    next = {
      ...next,
      syncStatus: 'synced',
      tgMessageId,
      syncError: undefined,
      updatedAt: new Date().toISOString(),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sync error'
    const cfgOk = isFeedbackApiConfigured()
    next = {
      ...next,
      syncStatus: cfgOk ? 'error' : 'local',
      syncError: cfgOk ? msg : undefined,
    }
  }
  upsertFeedback(next)
  return next
}

export function remoteImageUrl(id: string): string | null {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return null
  return `${cfg.baseUrl}/api/feedback/${encodeURIComponent(id)}/image`
}
