/** REST-клиент дневных отчётов / control links / media → local Docker API. */

import { isFeedbackApiConfigured, loadFeedbackApiConfig } from './feedbackConfig'
import type { ControlLink, ObjectDailyReport, ReportMediaMeta } from './objectReports'

const DEFAULT_TIMEOUT_MS = 12_000

function headers(token: string, extra?: HeadersInit): HeadersInit {
  return {
    'X-Feedback-Token': token,
    'ngrok-skip-browser-warning': '1',
    ...(extra ?? {}),
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`таймаут ${Math.round(timeoutMs / 1000)} с`)
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

export function isObjectReportsApiConfigured(): boolean {
  return isFeedbackApiConfigured()
}

export async function fetchObjectReportsRemote(token: string): Promise<ObjectDailyReport[]> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return []
  const res = await fetchWithTimeout(
    `${cfg.baseUrl}/api/object-reports?token=${encodeURIComponent(token)}`,
    { headers: headers(cfg.token) },
  )
  if (!res.ok) throw new Error(`GET object-reports ${res.status}`)
  const data = (await res.json()) as ObjectDailyReport[]
  return Array.isArray(data) ? data : []
}

export async function postObjectReportRemote(
  report: ObjectDailyReport,
): Promise<ObjectDailyReport> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) {
    throw new Error('API не настроен')
  }
  const res = await fetchWithTimeout(`${cfg.baseUrl}/api/object-reports`, {
    method: 'POST',
    headers: headers(cfg.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(report),
    timeoutMs: 15_000,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST object-reports ${res.status}${text ? `: ${text}` : ''}`)
  }
  return (await res.json()) as ObjectDailyReport
}

export async function fetchControlLinkRemote(token: string): Promise<ControlLink | null> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return null
  const res = await fetchWithTimeout(
    `${cfg.baseUrl}/api/control-links/${encodeURIComponent(token)}`,
    { headers: headers(cfg.token) },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET control-link ${res.status}`)
  return (await res.json()) as ControlLink
}

export async function postControlLinkRemote(link: ControlLink): Promise<ControlLink> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) {
    throw new Error('API не настроен')
  }
  const res = await fetchWithTimeout(`${cfg.baseUrl}/api/control-links`, {
    method: 'POST',
    headers: headers(cfg.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(link),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST control-link ${res.status}${text ? `: ${text}` : ''}`)
  }
  return (await res.json()) as ControlLink
}

/** Загрузить бинарник вложения отчёта на API (MVP sync фото между устройствами). */
export async function uploadReportMediaRemote(
  meta: ReportMediaMeta,
  blob: Blob,
): Promise<{ id: string; ok: boolean }> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) {
    throw new Error('API не настроен')
  }
  const fd = new FormData()
  fd.append('id', meta.id)
  fd.append('name', meta.name)
  fd.append('mime', meta.mime || blob.type || 'application/octet-stream')
  fd.append('kind', meta.kind)
  fd.append('file', blob, meta.name || meta.id)
  const res = await fetchWithTimeout(`${cfg.baseUrl}/api/object-report-media`, {
    method: 'POST',
    headers: headers(cfg.token),
    body: fd,
    timeoutMs: 30_000,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST media ${res.status}${text ? `: ${text}` : ''}`)
  }
  return (await res.json()) as { id: string; ok: boolean }
}

export async function fetchReportMediaRemote(id: string): Promise<Blob | null> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return null
  const res = await fetchWithTimeout(
    `${cfg.baseUrl}/api/object-report-media/${encodeURIComponent(id)}`,
    { headers: headers(cfg.token), timeoutMs: 30_000 },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET media ${res.status}`)
  return await res.blob()
}
