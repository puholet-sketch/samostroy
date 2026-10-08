import L from 'leaflet'
import type { ObjectStatus, RenovationObject } from '../../services/types'
import { computeFinance, type ObjectFinanceRow } from '../reports/financeMetrics'

export const STATUS_LABEL_RU: Record<ObjectStatus, string> = {
  lead: 'Лид',
  design: 'Дизайн',
  contract: 'Договор',
  in_progress: 'В работе',
  done: 'Завершён',
}

/** Brand-aware pin colors by object status */
export const STATUS_PIN_COLOR: Record<ObjectStatus, string> = {
  lead: '#94a3b8',
  design: '#f59e0b',
  contract: '#3b82f6',
  in_progress: '#2563eb',
  done: '#16a34a',
}

export const MOSCOW_BOUNDS: L.LatLngBoundsExpression = [
  [54.75, 35.4],
  [56.85, 39.6],
]

export function financeByObjectId(objects: RenovationObject[]): Map<string, ObjectFinanceRow> {
  const { rows } = computeFinance(objects)
  return new Map(rows.map((r) => [r.objectId, r]))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Full object title for map chips (no ellipsis / substring truncate). */
function mapLabel(o: RenovationObject): string {
  const title = o.title?.trim()
  if (title) return title.replace(/\s+/g, ' ')
  return (o.address?.trim() || 'Объект').replace(/\s+/g, ' ')
}

function housePinSvg(color: string): string {
  return `<svg class="ss-map-pin__svg" viewBox="0 0 32 40" width="32" height="40" aria-hidden="true">
  <path fill="${color}" stroke="#1e3a8a" stroke-width="1.2" stroke-opacity="0.25"
    d="M16 1.5C9.1 1.5 3.5 7.1 3.5 14c0 8.4 10.2 22.2 11.7 24.1a1 1 0 0 0 1.6 0C18.3 36.2 28.5 22.4 28.5 14 28.5 7.1 22.9 1.5 16 1.5z"/>
  <circle cx="16" cy="14" r="8.2" fill="#fff"/>
  <path fill="${color}" d="M16 8.2 10.8 12.4v6.2h3.1v-3.4h4.2v3.4h3.1v-6.2L16 8.2z"/>
</svg>`
}

export type MarkerIconOpts = {
  object: RenovationObject
  finance: ObjectFinanceRow | undefined
  /** Used for light vertical chip offset when markers are nearby */
  index?: number
}

export function createObjectMarkerIcon({ object, finance, index = 0 }: MarkerIconOpts): L.DivIcon {
  const color = STATUS_PIN_COLOR[object.status] ?? STATUS_PIN_COLOR.lead
  const label = escapeHtml(mapLabel(object))
  const planned = finance?.planned ?? 0
  const pct = planned > 0 ? Math.min(100, Math.max(0, finance?.pctPaid ?? 0)) : 0
  const pctRounded = Math.round(pct)
  const barHtml =
    planned > 0
      ? `<div class="ss-map-bar" title="Оплачено ${pctRounded}%">
          <span class="ss-map-bar__paid" style="width:${pctRounded}%"></span>
        </div>`
      : `<div class="ss-map-bar ss-map-bar--empty" title="Нет плана"></div>`

  const offsetMod = index % 3
  const html = `<div class="ss-map-marker ss-map-marker--${object.status} ss-map-marker--off${offsetMod}">
  <div class="ss-map-pin">${housePinSvg(color)}</div>
  <div class="ss-map-chip">
    <div class="ss-map-label">${label}</div>
    ${barHtml}
  </div>
</div>`

  return L.divIcon({
    className: 'ss-map-divicon',
    html,
    iconSize: [280, 64],
    iconAnchor: [16, 40],
    popupAnchor: [50, -36],
  })
}
