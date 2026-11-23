import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { loadClients } from '../../lib/clients'
import {
  downloadIssuedDocPdf,
  wizardHrefForDoc,
} from '../../lib/docActions'
import {
  kindLabel,
  listIssuedDocs,
  statusLabel,
  type IssuedDoc,
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
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const kind = (params.get('kind') || '') as '' | IssuedDocKind
  const [q, setQ] = useState(params.get('q') || '')
  const [clientId, setClientId] = useState(params.get('clientId') || '')
  const [objectId, setObjectId] = useState(params.get('objectId') || '')
  const [busyId, setBusyId] = useState('')
  const [err, setErr] = useState('')
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

  function openDoc(d: IssuedDoc) {
    const href = wizardHrefForDoc(d)
    if (href) navigate(href)
  }

  async function downloadPdf(d: IssuedDoc, e?: React.MouseEvent) {
    e?.stopPropagation()
    setErr('')
    setBusyId(d.id)
    try {
      await downloadIssuedDocPdf(d)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Не удалось скачать PDF')
    } finally {
      setBusyId('')
    }
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

      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2">№</th>
              <th className="px-3 py-2">Клиент</th>
              <th className="hidden px-3 py-2 md:table-cell">Объект</th>
              <th className="px-3 py-2">Статус</th>
              <th className="hidden px-3 py-2 sm:table-cell">Сумма</th>
              <th className="px-3 py-2">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Нет записей
                </td>
              </tr>
            ) : (
              docs.map((d) => {
                const c = clients.find((x) => x.id === d.clientId)
                const href = wizardHrefForDoc(d)
                return (
                  <tr
                    key={d.id}
                    className={`hover:bg-gray-50/80 ${href ? 'cursor-pointer' : ''}`}
                    onClick={() => openDoc(d)}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {kindLabel(d.kind)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {d.kind === 'act'
                        ? `этап ${d.actStageNumber ?? '—'}`
                        : d.contractNumber || '—'}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
                    <td className="hidden max-w-[14rem] truncate px-3 py-2 text-gray-600 md:table-cell">
                      {d.objectAddress || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">
                        {statusLabel(d.status)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-gray-700 sm:table-cell">
                      {d.total != null
                        ? `${d.total.toLocaleString('ru-RU')} ₽`
                        : '—'}
                    </td>
                    <td
                      className="px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex min-w-[7.5rem] flex-col gap-1 sm:min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-0.5">
                        {href && (
                          <Link
                            to={href}
                            className="text-xs font-medium text-blue-700 hover:underline"
                          >
                            Открыть
                          </Link>
                        )}
                        {d.kind !== 'furniture' && (
                          <button
                            type="button"
                            disabled={busyId === d.id}
                            className="text-left text-xs font-medium text-blue-700 hover:underline disabled:opacity-40"
                            onClick={(e) => void downloadPdf(d, e)}
                          >
                            {busyId === d.id ? 'PDF…' : 'Скачать PDF'}
                          </button>
                        )}
                        {href && d.kind !== 'furniture' && (
                          <Link
                            to={href}
                            className="text-xs font-medium text-gray-600 hover:underline"
                          >
                            Изменить
                          </Link>
                        )}
                      </div>
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
