/** Nominatim (OSM) address suggest — same provider as MapPage; no API key. */

export type AddressSuggestion = {
  label: string
  lat: number
  lng: number
}

type NominatimHit = {
  display_name?: string
  lat?: string
  lon?: string
}

const DEBOUNCE_MS = 400
const MIN_QUERY = 3
const LIMIT = 6

/** Moscow + MO bias (same as MapPage). */
const VIEWBOX = '35.5,56.8,39.5,54.8'

export function normalizeAddressLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;]+/g, ',')
}

export async function suggestAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (q.length < MIN_QUERY) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', q)
  url.searchParams.set('countrycodes', 'ru')
  url.searchParams.set('viewbox', VIEWBOX)
  url.searchParams.set('bounded', '0')
  url.searchParams.set('addressdetails', '0')
  url.searchParams.set('limit', String(LIMIT))

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
      // Nominatim usage policy: identify the app
      'Accept-Language': 'ru',
    },
  })
  if (!res.ok) return []

  const data = (await res.json()) as NominatimHit[]
  if (!Array.isArray(data)) return []

  const out: AddressSuggestion[] = []
  const seen = new Set<string>()
  for (const hit of data) {
    const label = (hit.display_name || '').trim()
    if (!label) continue
    const key = normalizeAddressLabel(label)
    if (seen.has(key)) continue
    seen.add(key)
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    out.push({ label, lat, lng })
  }
  return out
}

export { DEBOUNCE_MS, MIN_QUERY }

/** Exact (normalized) match of value against a suggestion list. */
export function findExactSuggestion(
  value: string,
  suggestions: AddressSuggestion[],
): AddressSuggestion | null {
  const n = normalizeAddressLabel(value)
  if (!n) return null
  return suggestions.find((s) => normalizeAddressLabel(s.label) === n) ?? null
}
