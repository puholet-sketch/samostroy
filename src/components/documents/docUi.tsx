import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadClients, type ClientCard, type ClientObject } from '../../lib/clients'
import { PhoneActions } from '../ui/PhoneActions'

export const inputCls =
  'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export function Field({
  label,
  children,
  className = '',
  hint,
}: {
  label: string
  children: React.ReactNode
  className?: string
  hint?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-0.5 block text-[11px] font-medium leading-tight text-gray-500">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-0.5 block text-[11px] leading-tight text-gray-400">{hint}</span>
      )}
    </label>
  )
}

export function objectLabel(o: ClientObject): string {
  const main =
    o.title && o.address && o.title !== o.address
      ? `${o.title} — ${o.address}`
      : o.address || o.title || 'Объект'
  return o.contractNumber ? `${main} · дог. ${o.contractNumber}` : main
}

function clientHaystack(c: ClientCard): string {
  return [
    c.name,
    c.email,
    c.mobile,
    c.city,
    c.address,
    ...c.objects.flatMap((o) => [o.title, o.address, o.contractNumber]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function useClientObjectPicker(initialClientId = '', initialObjectId = '') {
  const [clients] = useState(() => loadClients())
  const [q, setQ] = useState('')
  const [clientId, setClientId] = useState(initialClientId)
  const [objectId, setObjectId] = useState(initialObjectId)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return clients
    return clients.filter((c) => clientHaystack(c).includes(s))
  }, [clients, q])

  const client = clients.find((c) => c.id === clientId) ?? null
  const objects = client?.objects ?? []
  const selectedObject = objects.find((o) => o.id === objectId) ?? null

  function pickClient(c: ClientCard) {
    setClientId(c.id)
    setQ('')
    const objs = c.objects ?? []
    if (objs.length === 1) setObjectId(objs[0].id)
    else setObjectId('')
  }

  function clearClient() {
    setClientId('')
    setObjectId('')
  }

  return {
    clients,
    filtered,
    q,
    setQ,
    clientId,
    objectId,
    setObjectId,
    client,
    objects,
    selectedObject,
    pickClient,
    clearClient,
  }
}

export function ClientObjectPicker({
  picker,
}: {
  picker: ReturnType<typeof useClientObjectPicker>
}) {
  const {
    filtered,
    q,
    setQ,
    client,
    clientId,
    objects,
    objectId,
    setObjectId,
    pickClient,
    clearClient,
  } = picker
  const showList = q.trim().length > 0 || !client

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            className={inputCls}
            placeholder="Поиск клиента…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {showList && (
            <div className="max-h-28 overflow-y-auto rounded-md border border-gray-200">
              {filtered.length === 0 ? (
                <p className="px-2 py-2 text-xs text-gray-500">Никого не найдено</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.slice(0, 8).map((c) => (
                    <li
                      key={c.id}
                      className={`flex items-center gap-2 px-2 py-1.5 text-sm ${
                        clientId === c.id ? 'bg-blue-50' : 'hover:bg-blue-50/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => pickClient(c)}
                        className="min-w-0 flex-1 truncate text-left font-medium text-gray-900"
                      >
                        {c.name || 'Без имени'}
                      </button>
                      <PhoneActions phone={c.mobile} showNumber size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {client && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs">
            <span className="truncate font-medium text-emerald-900">{client.name}</span>
            <Link
              to={`/clients/${client.id}/docs`}
              className="font-medium text-blue-700 hover:underline"
            >
              Документы КК →
            </Link>
            <button
              type="button"
              className="text-emerald-800/70 hover:text-emerald-950"
              onClick={clearClient}
            >
              ×
            </button>
          </div>
        )}
      </div>
      {client && (
        <Field label="Объект">
          {objects.length === 0 ? (
            <p className="text-xs text-amber-700">
              Нет объектов — добавьте адрес в{' '}
              <Link to={`/clients/${client.id}/main`} className="underline">
                карточке
              </Link>
              .
            </p>
          ) : (
            <select
              className={inputCls}
              value={objectId}
              onChange={(e) => setObjectId(e.target.value)}
            >
              <option value="">Выберите объект…</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {objectLabel(o)}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
    </div>
  )
}

export function WizardShell({
  title,
  backTo = '/documents',
  children,
  footer,
}: {
  title: string
  backTo?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="-mx-1 space-y-3 pb-24">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={backTo}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← Хаб документов
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      {children}
      {footer && (
        <div className="sticky bottom-0 z-10 -mx-1 border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  )
}

export const todayIso = () => new Date().toISOString().slice(0, 10)
