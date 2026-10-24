/** Настройки Feedback API (фаза A: Termux). */

const KEY = 'samostroy:feedback_api'

export type FeedbackApiConfig = {
  baseUrl: string
  token: string
}

export function loadFeedbackApiConfig(): FeedbackApiConfig {
  const fromEnvUrl = (import.meta.env.VITE_FEEDBACK_API_URL as string | undefined)?.trim() ?? ''
  const fromEnvToken = (import.meta.env.VITE_FEEDBACK_API_TOKEN as string | undefined)?.trim() ?? ''
  try {
    const raw = localStorage.getItem(KEY)
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
    KEY,
    JSON.stringify({
      baseUrl: cfg.baseUrl.replace(/\/$/, ''),
      token: cfg.token,
    }),
  )
}

export function isFeedbackApiConfigured(cfg = loadFeedbackApiConfig()): boolean {
  return Boolean(cfg.baseUrl && cfg.token)
}
