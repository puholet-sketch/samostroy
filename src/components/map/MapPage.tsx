import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { useObjects } from '../../hooks/useObjects'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../services/api'

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type Suggest = { display_name: string; lat: string; lon: string }

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 12, { duration: 0.8 })
  }, [lat, lng, map])
  return null
}

export default function MapPage() {
  const { objects, reload } = useObjects()
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [suggests, setSuggests] = useState<Suggest[]>([])
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [msg, setMsg] = useState('')

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
        <h1 className="text-2xl font-bold text-gray-900">Карта</h1>
        <p className="text-sm text-gray-500 mt-1">Москва и МО · поиск адресов через Nominatim (OSM)</p>
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

      <div className="card p-2 h-[480px]">
        <MapContainer center={[center.lat, center.lng]} zoom={9} scrollWheelZoom className="h-full w-full rounded-xl">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {focus && <FlyTo lat={focus.lat} lng={focus.lng} />}
          {objects.map((o) => (
            <Marker key={o.id} position={[o.lat, o.lng]} icon={markerIcon}>
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{o.title}</div>
                  <div className="text-gray-600">{o.address}</div>
                  <Link to={`/objects/${o.id}`} className="text-primary-600 underline">
                    Карточка
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
