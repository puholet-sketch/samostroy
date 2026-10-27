/** REST-клиент дневных отчётов / control links → local Docker API. */

import { isFeedbackApiConfigured, loadFeedbackApiConfig } from './feedbackConfig'
import type { ControlLink, ObjectDailyReport } from './objectReports'

function headers(token: string, extra?: HeadersInit): HeadersInit {
  return { 'X-Feedback-Token': token, ...(extra ?? {}) }
}

export function isObjectReportsApiConfigured(): boolean {
  return isFeedbackApiConfigured()
}

export async function fetchObjectReportsRemote(token: string): Promise<ObjectDailyReport[]> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) return []
  const res = await fetch(
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
  const res = await fetch(`${cfg.baseUrl}/api/object-reports`, {
    method: 'POST',
    headers: headers(cfg.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(report),
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
  const res = await fetch(`${cfg.baseUrl}/api/control-links/${encodeURIComponent(token)}`, {
    headers: headers(cfg.token),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET control-link ${res.status}`)
  return (await res.json()) as ControlLink
}

export async function postControlLinkRemote(link: ControlLink): Promise<ControlLink> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) {
    throw new Error('API не настроен')
  }
  const res = await fetch(`${cfg.baseUrl}/api/control-links`, {
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
