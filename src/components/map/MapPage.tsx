import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { useObjects } from '../../hooks/useObjects'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'
import { formatPct, formatRub } from '../reports/financeMetrics'
import {
  MOSCOW_BOUNDS,
  STATUS_LABEL_RU,
  STATUS_PIN_COLOR,
  createObjectMarkerIcon,
  financeByObjectId,
} from './mapMarkers'
import type { ObjectStatus } from '../../services/types'

type Suggest = { display_name: string; lat: string; lon: string }

type BasemapId = 'hot' | 'light' | 'topo' | 'dark' | 'satellite'

/** Бесплатные тайлы без API key. */
const BASEMAPS: Record<
  BasemapId,
  { label: string; url: string; attribution: string; maxZoom: number; subdomains?: string }
> = {
  hot: {
    label: 'HOT',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://www.hotosm.org/">HOT</a>',
    maxZoom: 19,
    subdomains: 'abc',
  },
  light: {
    label: 'Светлая',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS',
    maxZoom: 16,
  },
  topo: {
    label: 'Топо',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS',
    maxZoom: 19,
  },
  dark: {
    label: 'Тёмная',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS',
    maxZoom: 16,
  },
  satellite: {
    label: 'Спутник',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 12, { duration: 0.8 })
  }, [lat, lng, map])
  return null
}

const LEGEND_STATUSES: ObjectStatus[] = ['lead', 'design', 'contract', 'in_progress', 'done']

export default function MapPage() {
  const { objects, reload } = useObjects()
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [suggests, setSuggests] = useState<Suggest[]>([])
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [msg, setMsg] = useState('')
  const [basemap, setBasemap] = useState<BasemapId>('hot')
  const tiles = BASEMAPS[basemap]

  const financeMap = useMemo(() => financeByObjectId(objects), [objects])

  const markerIcons = useMemo(() => {
    const m = new Map<string, ReturnType<typeof createObjectMarkerIcon>>()
    objects.forEach((o, index) => {
      m.set(o.id, createObjectMarkerIcon({ object: o, finance: financeMap.get(o.id), index }))
    })
    return m
  }, [objects, financeMap])

  const center = useMemo(() => {
    if (focus) return focus
    if (objects[0]) return { lat: objects[0].lat, lng: objects[0].lng }
    return { lat: 55.751244, lng: 37.618423 }
  }, [focus, objects])

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggests([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const url = new URL('https://nominatim.openstreetmap.org/search')
          url.searchParams.set('format', 'json')
          url.searchParams.set('q', query)
          url.searchParams.set('countrycodes', 'ru')
          url.searchParams.set('viewbox', '35.5,56.8,39.5,54.8')
          url.searchParams.set('bounded', '0')
          url.searchParams.set('limit', '6')
          const res = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
          })
          if (!res.ok) return
          const data = (await res.json()) as Suggest[]
          setSuggests(data)
        } catch {
          setSuggests([])
        }
      })()
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  async function applyCoords(lat: number, lng: number, address?: string) {
    setFocus({ lat, lng })
    setSuggests([])
    if (!selectedId || !can('map', 'write')) return
    const obj = objects.find((o) => o.id === selectedId)
    if (!obj) return
    const next = {
      ...obj,
      lat,
      lng,
      address: address ?? obj.address,
    }
    await api.objects.save(next)
    setMsg('Координаты объекта обновлены')
    await reload()
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Карта</h1>
            <p className="text-sm text-gray-500 mt-1">Москва и МО · OSM HOT по умолчанию</p>
          </div>
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 self-stretch sm:self-auto">
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`flex-1 sm:flex-none min-h-10 px-3 py-2 text-sm rounded-md transition-colors ${
                  basemap === id
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setBasemap(id)}
              >
                {BASEMAPS[id].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <label className="label">Поиск адреса</label>
            <input
              className="input"
              placeholder="Например: Химки, ул. Репина"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {suggests.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
                {suggests.map((s) => (
                  <li key={`${s.lat}-${s.lon}-${s.display_name}`}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50"
                      onClick={() => {
                        setQuery(s.display_name)
                        void applyCoords(Number(s.lat), Number(s.lon), s.display_name)
                      }}
                    >
                      {s.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="label">Привязать к объекту</label>
            <select
              className="input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={!can('map', 'write')}
            >
              <option value="">Только показать на карте</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
      </div>

      <div className="card p-2 relative h-[min(70vh,560px)] min-h-[280px]">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={9}
          minZoom={8}
          maxBounds={MOSCOW_BOUNDS}
          maxBoundsViscosity={0.85}
          scrollWheelZoom
          className="h-full w-full rounded-xl"
        >
          <TileLayer
            key={basemap}
            attribution={tiles.attribution}
            url={tiles.url}
            maxZoom={tiles.maxZoom}
            {...(tiles.subdomains ? { subdomains: tiles.subdomains } : {})}
          />
          {focus && <FlyTo lat={focus.lat} lng={focus.lng} />}
          {objects.map((o) => {
            const fin = financeMap.get(o.id)
            const planned = fin?.planned ?? 0
            const paid = fin?.paid ?? 0
            const remaining = fin?.remaining ?? 0
            const pct = fin?.pctPaid ?? 0
            const pctW = planned > 0 ? Math.min(100, Math.max(0, pct)) : 0
            return (
              <Marker key={o.id} position={[o.lat, o.lng]} icon={markerIcons.get(o.id)}>
                <Popup className="ss-map-popup-wrap" maxWidth={280}>
                  <div className="ss-map-popup">
                    <div className="ss-map-popup__title">{o.title}</div>
                    <div className="ss-map-popup__addr">{o.address}</div>
                    <div className="ss-map-popup__status">
                      <span
                        className="ss-map-popup__dot"
                        style={{ background: STATUS_PIN_COLOR[o.status] }}
                      />
                      {STATUS_LABEL_RU[o.status] ?? o.status}
                    </div>
                    <div className="ss-map-popup__finance">
                      <div className="ss-map-popup__row">
                        <span>Сумма ремонта (план)</span>
                        <strong>{formatRub(planned)}</strong>
                      </div>
                      <div className="ss-map-popup__row">
                        <span>Оплачено</span>
                        <strong className="text-green-700">{formatRub(paid)}</strong>
                      </div>
                      <div className="ss-map-popup__row">
                        <span>Остаток</span>
                        <strong className="text-red-700">{formatRub(remaining)}</strong>
                      </div>
                      <div className="ss-map-popup__bar" title={formatPct(pct)}>
                        <span className="ss-map-popup__bar-paid" style={{ width: `${pctW}%` }} />
                      </div>
                      <div className="ss-map-popup__pct">{formatPct(pct)} оплачено</div>
                    </div>
                    <Link to={`/objects/${o.id}`} className="ss-map-popup__link">
                      Карточка объекта
                    </Link>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        <div className="ss-map-legend" aria-label="Легенда статусов">
          <div className="ss-map-legend__title">Статус объекта</div>
          <ul className="ss-map-legend__list">
            {LEGEND_STATUSES.map((s) => (
              <li key={s}>
                <span className="ss-map-legend__swatch" style={{ background: STATUS_PIN_COLOR[s] }} />
                {STATUS_LABEL_RU[s]}
              </li>
            ))}
          </ul>
          <p className="ss-map-legend__hint">Полоска: оплачено (зелёный) / остаток</p>
        </div>
      </div>
    </div>
  )
}
