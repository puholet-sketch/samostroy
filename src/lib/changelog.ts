import raw from '@data/changelog.json'

export type ChangeItem = { section: string; text: string }

/** Ссылка на системную документацию или раздел приложения */
export type ReleaseDocLink = {
  label: string
  /** Путь в репо (`docs/…`) или in-app маршрут (`/feedback`) */
  href: string
  /** `repo` — файл в репозитории; `app` — маршрут CRM */
  kind: 'repo' | 'app'
}

export type Release = {
  /** Уникальный id = slug маршрута `/updates/:releaseId` */
  id: string
  at: string
  title: string
  items: ChangeItem[]
  /** Ссылки на системную документацию (опционально) */
  docs?: ReleaseDocLink[]
}

function asDocLink(v: unknown): ReleaseDocLink | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.label !== 'string' || typeof o.href !== 'string') return null
  const kind = o.kind === 'app' ? 'app' : 'repo'
  return { label: o.label, href: o.href, kind }
}

function asRelease(v: unknown): Release | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.at !== 'string' || typeof o.title !== 'string') return null
  if (!Array.isArray(o.items)) return null
  const items: ChangeItem[] = o.items
    .filter((it): it is ChangeItem => {
      if (!it || typeof it !== 'object') return false
      const x = it as Record<string, unknown>
      return typeof x.section === 'string' && typeof x.text === 'string'
    })
    .map((it) => ({ section: it.section, text: it.text }))
  const docs = Array.isArray(o.docs)
    ? (o.docs.map(asDocLink).filter(Boolean) as ReleaseDocLink[])
    : undefined
  return {
    id: o.id,
    at: o.at,
    title: o.title,
    items,
    ...(docs && docs.length ? { docs } : {}),
  }
}

function asReleases(data: unknown): Release[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && 'default' in data
      ? (data as { default: unknown }).default
      : null
  if (!Array.isArray(list)) return []
  return list.map(asRelease).filter((r): r is Release => r !== null)
}

/** Список релизов для раздела «Обновления» */
export const RELEASES: Release[] = asReleases(raw)

export function getReleaseById(id: string): Release | undefined {
  return RELEASES.find((r) => r.id === id)
}
