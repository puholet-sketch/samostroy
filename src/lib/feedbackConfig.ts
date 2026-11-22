/** Настройки Feedback API и email-канала (Web3Forms). */

const API_KEY = 'samostroy:feedback_api'
const EMAIL_KEY = 'samostroy:feedback_email'

export const DEFAULT_FEEDBACK_EMAIL_TO = 'sorvanvon@yandex.ru'

export type FeedbackApiConfig = {
  baseUrl: string
  token: string
}

export type FeedbackEmailConfig = {
  /** Web3Forms access key (публичный, VITE_ / Настройки → Замечания / API) */
  accessKey: string
  /**
   * Метка ящика команды в теле письма.
   * Доставка идёт на email, с которым создан access key — free tier не перенаправляет.
   */
  emailTo: string
}

/** Runtime base from public/api-config.json (set by bootstrapRuntimeApiConfig). */
let runtimeApiBase = ''

function bakedEnvApiUrl(): string {
  return (
    (import.meta.env.VITE_FEEDBACK_API_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    ''
  )
}

function bakedEnvApiToken(): string {
  return (
    (import.meta.env.VITE_FEEDBACK_API_TOKEN as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim() ||
    ''
  )
}

/**
 * Fetch `${BASE_URL}api-config.json` (no-cache) so Pages can pick up a new tunnel
 * hostname without a full Vite rebuild. CRM Settings Base URL still wins if set.
 */
export async function bootstrapRuntimeApiConfig(): Promise<void> {
  try {
    const base = import.meta.env.BASE_URL || '/'
    const url = `${base}api-config.json`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return
    const data = (await res.json()) as { apiBase?: unknown }
    const apiBase = typeof data.apiBase === 'string' ? data.apiBase.trim().replace(/\/$/, '') : ''
    if (apiBase) runtimeApiBase = apiBase
  } catch {
    /* keep baked env */
  }
}

export function getRuntimeApiBase(): string {
  return runtimeApiBase
}

export function loadFeedbackApiConfig(): FeedbackApiConfig {
  // Priority: CRM localStorage override → runtime api-config.json → VITE_* bake
  const fromEnvUrl = bakedEnvApiUrl()
  const fromEnvToken = bakedEnvApiToken()
  const defaultUrl = (runtimeApiBase || fromEnvUrl).replace(/\/$/, '')
  try {
    const raw = localStorage.getItem(API_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeedbackApiConfig>
      const lsUrl = typeof parsed.baseUrl === 'string' ? parsed.baseUrl.trim() : ''
      return {
        baseUrl: (lsUrl || defaultUrl).replace(/\/$/, ''),
        token: parsed.token || fromEnvToken,
      }
    }
  } catch {
    /* ignore */
  }
  return { baseUrl: defaultUrl, token: fromEnvToken }
}

export function saveFeedbackApiConfig(cfg: FeedbackApiConfig): void {
  localStorage.setItem(
    API_KEY,
    JSON.stringify({
      baseUrl: cfg.baseUrl.replace(/\/$/, ''),
      token: cfg.token,
    }),
  )
}

export function isFeedbackApiConfigured(cfg = loadFeedbackApiConfig()): boolean {
  return Boolean(cfg.baseUrl && cfg.token)
}

export function loadFeedbackEmailConfig(): FeedbackEmailConfig {
  const fromEnvKey =
    (import.meta.env.VITE_WEB3FORMS_ACCESS_KEY as string | undefined)?.trim() ?? ''
  const fromEnvTo =
    (import.meta.env.VITE_FEEDBACK_EMAIL_TO as string | undefined)?.trim() ||
    DEFAULT_FEEDBACK_EMAIL_TO
  try {
    const raw = localStorage.getItem(EMAIL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeedbackEmailConfig>
      // Пустая строка в localStorage не должна перекрывать ключ из сборки Pages
      const lsKey = typeof parsed.accessKey === 'string' ? parsed.accessKey.trim() : ''
      const lsTo = typeof parsed.emailTo === 'string' ? parsed.emailTo.trim() : ''
      return {
        accessKey: lsKey || fromEnvKey,
        emailTo: lsTo || fromEnvTo || DEFAULT_FEEDBACK_EMAIL_TO,
      }
    }
  } catch {
    /* ignore */
  }
  return { accessKey: fromEnvKey, emailTo: fromEnvTo }
}

export function saveFeedbackEmailConfig(cfg: FeedbackEmailConfig): void {
  localStorage.setItem(
    EMAIL_KEY,
    JSON.stringify({
      accessKey: cfg.accessKey.trim(),
      emailTo: (cfg.emailTo.trim() || DEFAULT_FEEDBACK_EMAIL_TO),
    }),
  )
}

export function isFeedbackEmailConfigured(cfg = loadFeedbackEmailConfig()): boolean {
  return Boolean(cfg.accessKey)
}
