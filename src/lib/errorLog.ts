/** Persistent ring-buffer of client-side API/network failures (localStorage). */

export const ERROR_LOG_KEY = 'samostroy:error_log'
const MAX_ENTRIES = 40

export type ErrorLogEntry = {
  at: string
  kind: string
  message: string
  url?: string
  status?: number
  route?: string
  detail?: string
}

function currentRoute(): string | undefined {
  try {
    return `${window.location.pathname}${window.location.search}`.slice(0, 200)
  } catch {
    return undefined
  }
}

export function loadErrorLog(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ErrorLogEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearErrorLog(): void {
  localStorage.removeItem(ERROR_LOG_KEY)
}

export function appendErrorLog(
  partial: Omit<ErrorLogEntry, 'at' | 'route'> & { route?: string; at?: string },
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    at: partial.at ?? new Date().toISOString(),
    kind: partial.kind,
    message: String(partial.message || 'error').slice(0, 500),
    url: partial.url?.slice(0, 400),
    status: partial.status,
    route: (partial.route ?? currentRoute())?.slice(0, 200),
    detail: partial.detail?.slice(0, 400),
  }
  try {
    const next = [entry, ...loadErrorLog()].slice(0, MAX_ENTRIES)
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
  console.error('[samostroy]', entry.kind, entry.message, {
    url: entry.url,
    status: entry.status,
    route: entry.route,
    detail: entry.detail,
  })
  return entry
}

/** Classify fetch/network failures for logging. */
export function logFetchFailure(opts: {
  kind: string
  url: string
  error?: unknown
  status?: number
  bodySnippet?: string
}): void {
  const err = opts.error
  let message = 'fetch failed'
  if (typeof opts.status === 'number') {
    message = `HTTP ${opts.status}`
  } else if (err instanceof Error) {
    message = err.message || err.name
  } else if (err != null) {
    message = String(err)
  }
  appendErrorLog({
    kind: opts.kind,
    message,
    url: opts.url,
    status: opts.status,
    detail: opts.bodySnippet,
  })
}
