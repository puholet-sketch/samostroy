import { isFeedbackApiConfigured, loadFeedbackApiConfig } from './feedbackConfig'
import { sendFeedbackEmail } from './feedbackEmail'
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

/** Сохранить локально, попытаться API, затем email (Web3Forms). */
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

  const email = await sendFeedbackEmail(next, imageBlob)
  if (email.skipped) {
    next = { ...next, emailStatus: 'skipped', emailAttached: false, emailError: undefined }
  } else if (email.ok) {
    next = {
      ...next,
      emailStatus: 'sent',
      emailAttached: email.attached,
      emailError: undefined,
      updatedAt: new Date().toISOString(),
    }
    // На Pages без API письмо — единственный канал до разработчика
    if (next.syncStatus === 'local' || next.syncStatus === 'pending') {
      next = { ...next, syncStatus: 'synced', syncError: undefined }
    }
  } else {
    next = {
      ...next,
      emailStatus: 'error',
      emailAttached: false,
      emailError: email.error,
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

/** Текст статуса для заказчика после отправки. */
export function feedbackSubmitUserMessage(item: FeedbackItem): string {
  if (item.emailStatus === 'sent') {
    const attach = item.emailAttached
      ? 'письмо с вложением ушло на почту разработчика'
      : 'письмо ушло на почту разработчика (скрин — в этом браузере)'
    return `Отправлено на почту · ${attach} · ${item.id}`
  }

  if (item.emailStatus === 'error') {
    const detail = item.emailError ? ` (${item.emailError})` : ''
    return `Ошибка: письмо не доставлено${detail}. Сохранено только в этом браузере · ${item.id}`
  }

  if (item.emailStatus === 'skipped') {
    return `Ошибка: email-канал не настроен в сборке. Сохранено только в этом браузере · ${item.id}`
  }

  const parts: string[] = [`Сохранено · ${item.id}`]
  if (item.syncStatus === 'synced' && item.tgMessageId != null) {
    parts.push('очередь API')
  } else if (item.syncStatus === 'error') {
    parts.push('API недоступен')
  } else if (item.syncStatus === 'local') {
    parts.push('только в этом браузере')
  }
  return parts.join(' · ')
}

/** Успешная доставка разработчику (email и/или API). */
export function feedbackSubmitSucceeded(item: FeedbackItem): boolean {
  return item.emailStatus === 'sent' || (item.syncStatus === 'synced' && item.tgMessageId != null)
}
