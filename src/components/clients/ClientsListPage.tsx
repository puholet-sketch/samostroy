import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageHeaderActions } from '../../contexts/PageHeaderContext'
import {
  CHANNEL_OPTIONS,
  emptyClient,
  hydrateLocalCrmIfEmpty,
  loadClients,
  matchClientFilters,
  saveClients,
  type ClientCard,
} from '../../lib/clients'
import { Kpi } from '../ui/Kpi'
import { PhoneActions } from '../ui/PhoneActions'

const filterCls =
  'rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function isLead(c: ClientCard) {
  const t = c.tag.toLowerCase()
  return t.includes('лид') || t.includes('lead')
}

function isContract(c: ClientCard) {
  const t = c.tag.toLowerCase()
  return t.includes('договор') || t.includes('contract')
}

export default function ClientsListPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientCard[]>(() => loadClients())
  const [qName, setQName] = useState('')
  const [qPhone, setQPhone] = useState('')
  const [qChannel, setQChannel] = useState('')

  useEffect(() => {
    document.title = 'Клиенты — СамоСтрой'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (clients.length > 0) return
      await hydrateLocalCrmIfEmpty()
      const next = loadClients()
      if (!cancelled && next.length > 0) setClients(next)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (clients.length === 0) return
    saveClients(clients)
  }, [clients])

  function addClient() {
    const row = emptyClient({ name: 'Новый клиент', tag: 'лид' })
    const next = [row, ...clients]
    setClients(next)
    saveClients(next)
    navigate(`/clients/${row.id}/main`)
  }

  const headerBtn = useMemo(
    () => (
      <button
        type="button"
        onClick={addClient}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:px-4"
      >
        + Новый клиент
      </button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients],
  )
  usePageHeaderActions(headerBtn)

  const filtered = useMemo(
    () =>
      clients.filter((c) =>
        matchClientFilters(c, { name: qName, phone: qPhone, channel: qChannel }),
      ),
    [clients, qName, qPhone, qChannel],
  )

  const leads = clients.filter(isLead).length
  const contracts = clients.filter(isContract).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Всего" value={clients.length} accent="blue" />
        <Kpi label="Лиды" value={leads} accent="amber" />
        <Kpi label="Договоры" value={contracts} accent="emerald" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className={`${filterCls} w-36 min-w-0 shrink sm:w-44`}
            placeholder="ФИО"
            value={qName}
            onChange={(e) => setQName(e.target.value)}
          />
          <input
            className={`${filterCls} w-32 min-w-0 shrink tabular-nums sm:w-40`}
            placeholder="Телефон"
            inputMode="tel"
            value={qPhone}
            onChange={(e) => setQPhone(e.target.value)}
          />
          <select
            className={`${filterCls} min-w-0 flex-1 sm:max-w-xs`}
            value={qChannel}
            onChange={(e) => setQChannel(e.target.value)}
          >
            <option value="">Канал продаж — все</option>
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">ФИО / Организация</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Телефон</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Канал</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Город</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Менеджер</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Тег</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Тип</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Ничего не найдено
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-blue-50/60"
                  onClick={() => navigate(`/clients/${c.id}/main`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      to={`/clients/${c.id}/main`}
                      className="text-blue-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.name || 'Без имени'}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PhoneActions phone={c.mobile} stopPropagation />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {c.channel || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{c.city || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{c.manager || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {c.tag || '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                        c.fizurlico === 'ur'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {c.fizurlico === 'ur' ? 'Юр' : 'Физ'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
