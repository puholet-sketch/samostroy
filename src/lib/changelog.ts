import raw from '@data/changelog.json'

export type ChangeItem = { section: string; text: string }
export type Release = { id: string; at: string; title: string; items: ChangeItem[] }

function asReleases(data: unknown): Release[] {
  if (Array.isArray(data)) return data as Release[]
  if (data && typeof data === 'object' && 'default' in data) {
    const d = (data as { default: unknown }).default
    if (Array.isArray(d)) return d as Release[]
  }
  return []
}

/** Список релизов для раздела «Обновления» */
export const RELEASES: Release[] = asReleases(raw)
