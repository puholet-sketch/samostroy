/** REST-клиент дневных отчётов / control links / media → local Docker API. */

import { logFetchFailure } from './errorLog'
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
  init: RequestInit & { timeoutMs?: number; logKind?: string } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, logKind = 'object-reports-api', ...rest } = init
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      const msg = `таймаут ${Math.round(timeoutMs / 1000)} с`
      logFetchFailure({ kind: logKind, url: input, error: new Error(msg) })
      throw new Error(msg)
    }
    logFetchFailure({ kind: logKind, url: input, error: e })
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

async function assertOk(
  res: Response,
  kind: string,
  label: string,
): Promise<void> {
  if (res.ok) return
  const text = await res.text().catch(() => '')
  logFetchFailure({
    kind,
    url: res.url || label,
    status: res.status,
    bodySnippet: text.slice(0, 200),
  })
  throw new Error(`${label} ${res.status}${text ? `: ${text}` : ''}`)
}

export function isObjectReportsApiConfigured(): boolean {
  return isFeedbackApiConfigured()
}

export async function fetchObjectReportsRemote(token: string): Promise<ObjectDailyReport[]> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return []
  const url = `${cfg.baseUrl}/api/object-reports?token=${encodeURIComponent(token)}`
  const res = await fetchWithTimeout(url, {
    headers: headers(cfg.token),
    logKind: 'object-reports-get',
  })
  if (!res.ok) {
    await assertOk(res, 'object-reports-get', 'GET object-reports')
  }
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
  const url = `${cfg.baseUrl}/api/object-reports`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: headers(cfg.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(report),
    timeoutMs: 25_000,
    logKind: 'object-reports-post',
  })
  if (!res.ok) {
    await assertOk(res, 'object-reports-post', 'POST object-reports')
  }
  return (await res.json()) as ObjectDailyReport
}

export async function fetchControlLinkRemote(token: string): Promise<ControlLink | null> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return null
  const url = `${cfg.baseUrl}/api/control-links/${encodeURIComponent(token)}`
  const res = await fetchWithTimeout(url, {
    headers: headers(cfg.token),
    logKind: 'control-link-get',
  })
  if (res.status === 404) return null
  if (!res.ok) {
    await assertOk(res, 'control-link-get', 'GET control-link')
  }
  return (await res.json()) as ControlLink
}

export async function postControlLinkRemote(link: ControlLink): Promise<ControlLink> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) {
    throw new Error('API не настроен')
  }
  const url = `${cfg.baseUrl}/api/control-links`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: headers(cfg.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(link),
    logKind: 'control-link-post',
  })
  if (!res.ok) {
    await assertOk(res, 'control-link-post', 'POST control-link')
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
  const url = `${cfg.baseUrl}/api/object-report-media`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: headers(cfg.token),
    body: fd,
    timeoutMs: 30_000,
    logKind: 'object-report-media-post',
  })
  if (!res.ok) {
    await assertOk(res, 'object-report-media-post', 'POST media')
  }
  return (await res.json()) as { id: string; ok: boolean }
}

export async function fetchReportMediaRemote(id: string): Promise<Blob | null> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return null
  const url = `${cfg.baseUrl}/api/object-report-media/${encodeURIComponent(id)}`
  const res = await fetchWithTimeout(url, {
    headers: headers(cfg.token),
    timeoutMs: 30_000,
    logKind: 'object-report-media-get',
  })
  if (res.status === 404) return null
  if (!res.ok) {
    await assertOk(res, 'object-report-media-get', 'GET media')
  }
  return await res.blob()
}
