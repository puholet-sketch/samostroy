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

export function loadFeedbackApiConfig(): FeedbackApiConfig {
  const fromEnvUrl = (import.meta.env.VITE_FEEDBACK_API_URL as string | undefined)?.trim() ?? ''
  const fromEnvToken = (import.meta.env.VITE_FEEDBACK_API_TOKEN as string | undefined)?.trim() ?? ''
  try {
    const raw = localStorage.getItem(API_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeedbackApiConfig>
      return {
        baseUrl: (parsed.baseUrl ?? fromEnvUrl).replace(/\/$/, ''),
        token: parsed.token ?? fromEnvToken,
      }
    }
  } catch {
    /* ignore */
  }
  return { baseUrl: fromEnvUrl.replace(/\/$/, ''), token: fromEnvToken }
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
