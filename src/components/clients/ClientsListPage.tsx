import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageHeaderActions } from '../../contexts/PageHeaderContext'
import {
  CHANNEL_OPTIONS,
  emptyClient,
  hydrateLocalCrmIfEmpty,
  loadClients,
  matchClientFilters,
  saveClients,
  sortClientsRecentFirst,
  type ClientCard,
} from '../../lib/clients'
import { PhoneActions } from '../ui/PhoneActions'

/** Fallback if no data row is mounted yet (py-3 + ~20px line ≈ 49). */
const ROW_H_FALLBACK = 49
const PAGE_SIZE_MIN = 3
const PAGE_SIZE_MAX = 40

/** AppShell header h-14 + main py-4 top/bottom */
const VIEWPORT_FILL =
  'flex h-[calc(100dvh-3.5rem-2rem)] max-h-[calc(100dvh-3.5rem-2rem)] flex-col overflow-hidden'

const filterCls =
  'rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function ClientsListPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientCard[]>(() => loadClients())
  const [qName, setQName] = useState('')
  const [qPhone, setQPhone] = useState('')
  const [qChannel, setQChannel] = useState('')
  /** Клиенты с ≥1 объектом «в работе» */
  const [onlyInWork, setOnlyInWork] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const scrollRef = useRef<HTMLDivElement>(null)
  const theadRef = useRef<HTMLTableSectionElement>(null)

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
    setPage(1)
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

  const filtered = useMemo(() => {
    const matched = clients.filter((c) => {
      if (!matchClientFilters(c, { name: qName, phone: qPhone, channel: qChannel })) {
        return false
      }
      if (onlyInWork) {
        return (c.objects ?? []).some((o) => o.inWork)
      }
      return true
    })
    return sortClientsRecentFirst(matched)
  }, [clients, qName, qPhone, qChannel, onlyInWork])

  /** Сколько строк помещается в высоту скролл-контейнера (ResizeObserver). */
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const measure = () => {
      const theadH = theadRef.current?.offsetHeight ?? 40
      const sample = el.querySelector<HTMLElement>('tbody tr[data-client-row]')
      const rowH = sample?.offsetHeight || ROW_H_FALLBACK
      const avail = Math.max(0, el.clientHeight - theadH)
      const n = Math.min(
        PAGE_SIZE_MAX,
        Math.max(PAGE_SIZE_MIN, Math.floor(avail / rowH) || PAGE_SIZE_MIN),
      )
      setPageSize((prev) => (prev === n ? prev : n))
    }

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [filtered.length])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [qName, qPhone, qChannel, onlyInWork])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, filtered.length)

  return (
    <div className={VIEWPORT_FILL}>
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <form
          className="mb-3 flex shrink-0 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            // Enter / «Найти»: зафиксировать trim; список уже фильтруется live по onChange.
            setQName((v) => v.trim())
            setQPhone((v) => v.trim())
          }}
        >
          <input
            className={`${filterCls} w-36 min-w-0 shrink sm:w-44`}
            placeholder="ФИО"
            value={qName}
            onChange={(e) => setQName(e.target.value)}
            autoComplete="off"
          />
          <input
            className={`${filterCls} w-32 min-w-0 shrink tabular-nums sm:w-40`}
            placeholder="Телефон"
            inputMode="tel"
            value={qPhone}
            onChange={(e) => setQPhone(e.target.value)}
            autoComplete="off"
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
          <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 shadow-sm">
            <input
              type="checkbox"
              checked={onlyInWork}
              onChange={(e) => setOnlyInWork(e.target.checked)}
            />
            Объект в работе
          </label>
          <button
            type="submit"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Найти
          </button>
        </form>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200"
        >
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead
              ref={theadRef}
              className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase text-gray-500 shadow-[0_1px_0_0_rgba(229,231,235,1)]"
            >
              <tr>
                <th className="px-4 py-3 font-medium">ФИО / Организация</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Телефон</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Канал</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Город</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Менеджер</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Тег</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">В работе</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Тип</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Ничего не найдено
                  </td>
                </tr>
              )}
              {pageRows.map((c) => {
                const inWorkCount = (c.objects ?? []).filter((o) => o.inWork).length
                return (
                  <tr
                    key={c.id}
                    data-client-row
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
                      {inWorkCount > 0 ? (
                        <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          {inWorkCount} об.
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <p>
              {from}–{to} из {filtered.length}
              <span className="ml-1 text-xs text-gray-400">
                (по {pageSize} на экран, новые сверху)
              </span>
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Назад
              </button>
              <span className="tabular-nums px-2 text-xs text-gray-500">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
