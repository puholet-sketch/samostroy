/**
 * Уведомления о дедлайнах этапов договора: email (Web3Forms) + Telegram (feedback-bot).
 * Получатели из учёток Security (phone) + фиксированный +79773639300.
 */

import {
  isFeedbackApiConfigured,
  isFeedbackEmailConfigured,
  loadFeedbackApiConfig,
  loadFeedbackEmailConfig,
} from './feedbackConfig'
import { phoneDigits } from './phoneActions'
import { deadlinesDueSoon, formatDeadlineLine, type StageDeadline } from './stageDeadlines'
import { api } from '../services/api'
import type { User } from '../services/types'

/** Заказчик / пользователь из решений спринта */
export const SPRINT_NOTIFY_PHONE = '+79773639300'

const SENT_KEY = 'samostroy:deadline_notify_sent_v1'
const WEB3FORMS_URL = 'https://api.web3forms.com/submit'

export type NotifyRecipient = {
  name: string
  role: string
  phone: string
  source: 'user' | 'fixed'
}

export type DeadlineNotifyResult = {
  deadlines: StageDeadline[]
  recipients: NotifyRecipient[]
  email: { ok: boolean; skipped: boolean; error?: string }
  telegram: { ok: boolean; skipped: boolean; error?: string }
  alreadySent: boolean
}

function loadSentMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SENT_KEY)
    if (raw) return JSON.parse(raw) as Record<string, string>
  } catch {
    /* ignore */
  }
  return {}
}

function saveSentMap(map: Record<string, string>) {
  localStorage.setItem(SENT_KEY, JSON.stringify(map))
}

function fingerprint(deadlines: StageDeadline[], dayIso: string): string {
  const ids = deadlines.map((d) => `${d.clientId}:${d.objectId}:${d.kind}:${d.stageN}:${d.dueDate}`)
  return `${dayIso}|${ids.sort().join(';')}`
}

export async function collectNotifyRecipients(): Promise<NotifyRecipient[]> {
  const users = await api.users.list()
  const byPhone = new Map<string, NotifyRecipient>()

  function add(name: string, role: string, phone: string, source: 'user' | 'fixed') {
    const d = phoneDigits(phone)
    if (d.length < 10) return
    if (!byPhone.has(d)) {
      byPhone.set(d, { name, role, phone: phone.trim() || `+${d}`, source })
    }
  }

  add('Пользователь (спринт)', 'user', SPRINT_NOTIFY_PHONE, 'fixed')

  for (const u of users) {
    if (!u.active) continue
    if (u.role === 'owner' || u.role === 'foreman' || u.role === 'developer') {
      if (u.phone) add(u.name || u.login, u.role, u.phone, 'user')
    }
  }

  // если у владельца/прораба нет телефона — всё равно покажем fixed
  return [...byPhone.values()]
}

function buildBody(deadlines: StageDeadline[], recipients: NotifyRecipient[]): string {
  const lines = [
    'СамоСтрой — дедлайны этапов договора',
    `Дата проверки: ${new Date().toLocaleString('ru-RU')}`,
    '',
    'Получатели (телефоны для TG / phone-bot):',
    ...recipients.map((r) => `· ${r.name} (${r.role}): ${r.phone}`),
    '',
    `Ближайшие дедлайны (${deadlines.length}):`,
    ...deadlines.map((d, i) => `${i + 1}. ${formatDeadlineLine(d)}`),
    '',
    'Источник: startDate объекта + этапы договора (дизайн / ремонт).',
  ]
  return lines.join('\n')
}

async function sendEmail(text: string): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  const cfg = loadFeedbackEmailConfig()
  if (!isFeedbackEmailConfigured(cfg)) {
    return { ok: false, skipped: true, error: 'Web3Forms не настроен' }
  }
  try {
    const res = await fetch(WEB3FORMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: cfg.accessKey,
        subject: `СамоСтрой: дедлайны этапов (${new Date().toISOString().slice(0, 10)})`,
        from_name: 'СамоСтрой CRM',
        text,
        replyto: cfg.emailTo,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string }
    if (!res.ok || data.success === false) {
      return { ok: false, skipped: false, error: data.message || `HTTP ${res.status}` }
    }
    return { ok: true, skipped: false }
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function sendTelegram(
  text: string,
  recipients: NotifyRecipient[],
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  const cfg = loadFeedbackApiConfig()
  if (!isFeedbackApiConfigured(cfg)) {
    return { ok: false, skipped: true, error: 'Feedback API / туннель не настроен' }
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Feedback-Token': cfg.token,
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({
        text: text.slice(0, 3500),
        phones: recipients.map((r) => r.phone),
        kind: 'stage_deadline',
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, skipped: false, error: `API ${res.status}${body ? `: ${body}` : ''}` }
    }
    return { ok: true, skipped: false }
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Проверить дедлайны в окне withinDays и разослать (1 раз в сутки на тот же набор).
 * force=true — игнорировать dedupe.
 */
export async function runDeadlineNotify(opts?: {
  withinDays?: number
  force?: boolean
}): Promise<DeadlineNotifyResult> {
  const withinDays = opts?.withinDays ?? 3
  const deadlines = deadlinesDueSoon(withinDays)
  const recipients = await collectNotifyRecipients()
  const today = new Date().toISOString().slice(0, 10)
  const fp = fingerprint(deadlines, today)
  const sent = loadSentMap()

  if (deadlines.length === 0) {
    return {
      deadlines,
      recipients,
      email: { ok: true, skipped: true },
      telegram: { ok: true, skipped: true },
      alreadySent: false,
    }
  }

  if (!opts?.force && sent[fp]) {
    return {
      deadlines,
      recipients,
      email: { ok: true, skipped: true },
      telegram: { ok: true, skipped: true },
      alreadySent: true,
    }
  }

  const text = buildBody(deadlines, recipients)
  const [email, telegram] = await Promise.all([sendEmail(text), sendTelegram(text, recipients)])

  if (email.ok || telegram.ok) {
    sent[fp] = new Date().toISOString()
    // prune old
    const keys = Object.keys(sent)
    if (keys.length > 40) {
      for (const k of keys.slice(0, keys.length - 30)) delete sent[k]
    }
    saveSentMap(sent)
  }

  return { deadlines, recipients, email, telegram, alreadySent: false }
}

/** Подсказка UI: у кого нет телефона среди owner/foreman. */
export function usersMissingPhone(users: User[]): User[] {
  return users.filter(
    (u) => u.active && (u.role === 'owner' || u.role === 'foreman') && !phoneDigits(u.phone || '').length,
  )
}
