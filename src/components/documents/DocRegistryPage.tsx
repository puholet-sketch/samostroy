import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadClients } from '../../lib/clients'
import {
  kindLabel,
  listIssuedDocs,
  statusLabel,
  type IssuedDocKind,
} from '../../lib/docRegistry'
import { Field, WizardShell, inputCls } from './docUi'

const KINDS: { id: '' | IssuedDocKind; label: string }[] = [
  { id: '', label: 'Все' },
  { id: 'design', label: 'Дизайн' },
  { id: 'repair', label: 'Ремонт' },
  { id: 'act', label: 'Акты' },
  { id: 'smeta', label: 'Сметы' },
  { id: 'tz', label: 'ТЗ' },
  { id: 'furniture', label: 'Мебель' },
]

export default function DocRegistryPage() {
  const [params, setParams] = useSearchParams()
  const kind = (params.get('kind') || '') as '' | IssuedDocKind
  const [q, setQ] = useState(params.get('q') || '')
  const [clientId, setClientId] = useState(params.get('clientId') || '')
  const [objectId, setObjectId] = useState(params.get('objectId') || '')
  const clients = useMemo(() => loadClients(), [])

  useEffect(() => {
    document.title = 'Реестр документов — СамоСтрой'
  }, [])

  useEffect(() => {
    const cid = params.get('clientId') || ''
    const oid = params.get('objectId') || ''
    if (cid) setClientId(cid)
    if (oid) setObjectId(oid)
  }, [params])

  const docs = useMemo(
    () =>
      listIssuedDocs({
        kind: kind || undefined,
        clientId: clientId || undefined,
        objectId: objectId || undefined,
        q: q || undefined,
      }),
    [kind, clientId, objectId, q],
  )

  const client = clients.find((c) => c.id === clientId)
  const objects = client?.objects ?? []

  function setKind(k: '' | IssuedDocKind) {
    const next = new URLSearchParams(params)
    if (k) next.set('kind', k)
    else next.delete('kind')
    setParams(next)
  }

  return (
    <WizardShell title="Реестры документов">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.id || 'all'}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              kind === k.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-3">
        <Field label="Поиск">
          <input
            className={inputCls}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="№, адрес, название…"
          />
        </Field>
        <Field label="Клиент">
          <select
            className={inputCls}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setObjectId('')
            }}
          >
            <option value="">Все</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Объект">
          <select
            className={inputCls}
            value={objectId}
            disabled={!clientId}
            onChange={(e) => setObjectId(e.target.value)}
          >
            <option value="">Все</option>
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.address || o.title || o.id}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2">№</th>
              <th className="px-3 py-2">Клиент</th>
              <th className="px-3 py-2">Объект</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Сумма</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Нет записей
                </td>
              </tr>
            ) : (
              docs.map((d) => {
                const c = clients.find((x) => x.id === d.clientId)
                return (
                  <tr key={d.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {kindLabel(d.kind)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {d.kind === 'act'
                        ? `этап ${d.actStageNumber ?? '—'}`
                        : d.contractNumber || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {c ? (
                        <Link
                          to={`/clients/${c.id}/docs`}
                          className="text-blue-700 hover:underline"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        d.clientId
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2 text-gray-600">
                      {d.objectAddress || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">
                        {statusLabel(d.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {d.total != null
                        ? `${d.total.toLocaleString('ru-RU')} ₽`
                        : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </WizardShell>
  )
}
