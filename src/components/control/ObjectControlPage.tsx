import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import {
  CHANNEL_OPTIONS,
  loadClients,
  matchClientFilters,
  type ClientCard,
  type ClientObject,
} from '../../lib/clients'
import {
  datesWithReports,
  getOrCreateControlLink,
  hydrateReportsForToken,
  loadControlSelection,
  REPORTS_CHANGED_EVENT,
  saveControlSelection,
  todayIso,
  type ControlLink,
} from '../../lib/objectReports'
import { runDeadlineNotify } from '../../lib/deadlineNotify'
import { computeWeekReportKpi, currentWeekSatFri, fullWeekSatFri } from '../../lib/weekRange'
import { useAuth } from '../../contexts/AuthContext'
import { usePageHeaderMeta } from '../../contexts/PageHeaderContext'
import { PhoneActions } from '../ui/PhoneActions'

function controlReportPath(token: string, date: string) {
  return `/control/report/${token}?date=${encodeURIComponent(date)}`
}

type DayCell = { date: string; hasReport: boolean; future: boolean; today: boolean }

function buildMonth(year: number, month: number, reported: Set<string>): DayCell[] {
  const count = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayStr = todayIso()

  return Array.from({ length: count }, (_, i) => {
    const d = i + 1
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayDate = new Date(year, month, d)
    const future = dayDate > today0
    const isToday = date === todayStr
    const hasReport = reported.has(date)
    return { date, hasReport, future, today: isToday }
  })
}

function monthShort(month: number) {
  return new Date(2000, month, 1).toLocaleString('ru-RU', { month: 'short' })
}

function countMissInYear(year: number, reported: Set<string>): number {
  const today = new Date()
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let miss = 0
  for (let m = 0; m < 12; m++) {
    const days = new Date(year, m + 1, 0).getDate()
    for (let d = 1; d <= days; d++) {
      const dayDate = new Date(year, m, d)
      if (dayDate > today0) continue
      const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (!reported.has(date)) miss += 1
    }
  }
  return miss
}

/** Текущий год: прошлый + текущий (−1/+0). Прошлые годы: все 12. */
function monthsForViewYear(viewYear: number): { year: number; month: number }[] {
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth()
  if (viewYear < cy) {
    return Array.from({ length: 12 }, (_, m) => ({ year: viewYear, month: m }))
  }
  if (viewYear > cy) return []
  const prev = cm === 0 ? { year: cy - 1, month: 11 } : { year: cy, month: cm - 1 }
  return [prev, { year: cy, month: cm }]
}

const WEEKDAYS = ['п', 'в', 'с', 'ч', 'п', 'с', 'в']

function MiniMonth({
  year,
  month,
  reported,
  reportDate,
  onPick,
  size = 'sm',
}: {
  year: number
  month: number
  reported: Set<string>
  reportDate: string
  onPick: (date: string, future: boolean) => void
  /** sm — год (12 мес.), lg — два месяца на всю ширину */
  size?: 'sm' | 'lg'
}) {
  const days = useMemo(() => buildMonth(year, month, reported), [year, month, reported])
  const pad = (new Date(year, month, 1).getDay() + 6) % 7
  const large = size === 'lg'

  return (
    <div className="min-w-0">
      <p
        className={`text-center font-semibold capitalize leading-none text-gray-700 ${
          large ? 'mb-1 text-xs sm:text-sm' : 'mb-0.5 text-[10px]'
        }`}
      >
        {monthShort(month)}
      </p>
      <div className={`grid grid-cols-7 ${large ? 'gap-0.5 sm:gap-1' : 'gap-px'}`}>
        {WEEKDAYS.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className={`text-center leading-none text-gray-400 ${
              large ? 'pb-0.5 text-[10px] sm:text-xs' : 'text-[8px]'
            }`}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((d) => {
          const dayNum = Number(d.date.slice(-2))
          let cls = 'bg-gray-100 text-gray-400'
          if (!d.future) {
            cls = d.hasReport ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }
          if (d.today) cls += large ? ' ring-2 ring-blue-500' : ' ring-1 ring-blue-500'
          if (d.date === reportDate) {
            cls += large
              ? ' outline outline-2 outline-indigo-500'
              : ' outline outline-1 outline-indigo-500'
          }
          return (
            <button
              key={d.date}
              type="button"
              title={d.date}
              onClick={() => onPick(d.date, d.future)}
              className={`flex w-full items-center justify-center font-semibold tabular-nums leading-none ${
                large
                  ? 'h-8 rounded text-xs sm:h-9 sm:text-sm'
                  : 'h-4 rounded-[2px] text-[9px]'
              } ${cls}`}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const inputCls =
  'block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function ObjectCalendarCard({
  client,
  object,
  focused,
  onFocus,
  viewYear,
  reportDate,
  onReportDate,
  tick,
  onBump,
}: {
  client: ClientCard
  object: ClientObject
  focused: boolean
  onFocus: () => void
  viewYear: number
  reportDate: string
  onReportDate: (date: string) => void
  tick: number
  onBump: () => void
}) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const link: ControlLink = useMemo(
    () =>
      getOrCreateControlLink({
        clientId: client.id,
        objectId: object.id,
        objectTitle: object.title || object.address,
        objectAddress: object.address,
      }),
    [client.id, object.id, object.title, object.address],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      onBump()
      await hydrateReportsForToken(link.token)
      if (!cancelled) onBump()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bump is setState; token drives reload
  }, [link.token])

  useEffect(() => {
    const refresh = () => {
      onBump()
      void hydrateReportsForToken(link.token).then(onBump)
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onReports = (ev: Event) => {
      const detail = (ev as CustomEvent<{ token?: string }>).detail
      if (!detail?.token || detail.token === link.token) onBump()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener(REPORTS_CHANGED_EVENT, onReports)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener(REPORTS_CHANGED_EVENT, onReports)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.token])

  const reported = useMemo(() => {
    void tick
    return datesWithReports(link.token)
  }, [link.token, tick])

  const miss = useMemo(() => countMissInYear(viewYear, reported), [viewYear, reported])
  const calendarMonths = useMemo(() => monthsForViewYear(viewYear), [viewYear])
  const large = calendarMonths.length <= 2

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/report/${link.token}`
      : ''

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function openWeeklyPack() {
    const { from, to } = fullWeekSatFri()
    // Пакет на клиента: все inWork-адреса; objectId — якорь URL / fallback.
    const qs = new URLSearchParams({
      clientId: client.id,
      objectId: object.id,
      from,
      to,
    })
    navigate(`/control/weekly-pack?${qs.toString()}`)
  }

  return (
    <div
      onClick={onFocus}
      className={`rounded-lg border bg-white p-2 shadow-sm sm:p-2.5 ${
        focused
          ? 'border-emerald-400 ring-1 ring-emerald-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {object.address || object.title || 'Объект'}
            {focused ? (
              <span className="ml-1.5 text-[10px] font-medium text-emerald-700">на экране</span>
            ) : null}
          </p>
          <p className="truncate text-[11px] text-gray-500">
            {object.contractNumber ? `дог. ${object.contractNumber}` : 'без договора'}
            {' · '}
            <span className="text-emerald-700">в работе</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openWeeklyPack}
          className="shrink-0 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-900 hover:bg-indigo-100"
        >
          Пакет сб→пт
        </button>
      </div>

      <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
        <span className="shrink-0 text-gray-500">
          Без отчёта: <strong className="tabular-nums text-rose-600">{miss}</strong>
        </span>
        <span className="hidden text-gray-300 sm:inline">·</span>
        <span className="min-w-0 flex-1 truncate text-gray-500" title={shareUrl}>
          Прорабу: {shareUrl}
        </span>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="shrink-0 font-semibold text-blue-700 hover:underline"
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
        <Link
          to={controlReportPath(link.token, reportDate)}
          className="shrink-0 font-medium text-blue-700 hover:underline"
        >
          Форма →
        </Link>
      </div>

      <div
        className={
          large
            ? 'grid w-full grid-cols-2 gap-3 sm:gap-4'
            : 'grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
        }
      >
        {calendarMonths.map(({ year, month }) => (
          <MiniMonth
            key={`${object.id}-${year}-${month}`}
            year={year}
            month={month}
            reported={reported}
            reportDate={reportDate}
            size={large ? 'lg' : 'sm'}
            onPick={(date, future) => {
              onReportDate(date)
              if (!future) navigate(controlReportPath(link.token, date))
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ObjectControlPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isForeman = user?.role === 'foreman'
  const currentYear = new Date().getFullYear()
  const [clients] = useState<ClientCard[]>(() => loadClients())
  const [qName, setQName] = useState('')
  const [qPhone, setQPhone] = useState('')
  const [qChannel, setQChannel] = useState('')
  const saved = loadControlSelection()
  const [clientId, setClientId] = useState(saved?.clientId ?? '')
  const [objectId, setObjectId] = useState(saved?.objectId ?? '')
  const [viewYear, setViewYear] = useState(currentYear)
  const [reportDate, setReportDate] = useState(todayIso())
  const [tick, setTick] = useState(0)
  const periodDefaults = currentWeekSatFri()
  const [periodFrom, setPeriodFrom] = useState(periodDefaults.from)
  const [periodTo, setPeriodTo] = useState(periodDefaults.to)

  const bump = () => setTick((t) => t + 1)

  const weekKpi = useMemo(() => {
    void tick
    return computeWeekReportKpi()
  }, [tick])

  const headerMeta = useMemo(
    () => (
      <span className="text-xs tabular-nums text-gray-600">
        Неделя сб–пт:{' '}
        <strong className="text-emerald-700">{weekKpi.filled}</strong>
        {' / '}
        <strong className="text-rose-600">{weekKpi.missing}</strong>
        <span className="hidden text-gray-400 sm:inline">
          {' '}
          · {weekKpi.objects} об.
        </span>
      </span>
    ),
    [weekKpi],
  )
  usePageHeaderMeta(headerMeta)

  /** Клиенты с ≥1 объектом «в работе» (ремонт в процессе). */
  const inWorkClients = useMemo(
    () => clients.filter((c) => (c.objects ?? []).some((o) => o.inWork)),
    [clients],
  )

  const filteredClients = useMemo(
    () =>
      inWorkClients.filter((c) =>
        matchClientFilters(c, { name: qName, phone: qPhone, channel: qChannel }),
      ),
    [inWorkClients, qName, qPhone, qChannel],
  )

  const client = clients.find((c) => c.id === clientId) ?? null
  const inWorkObjects: ClientObject[] = useMemo(
    () => (client?.objects ?? []).filter((o) => o.inWork),
    [client],
  )

  useEffect(() => {
    if (clientId && objectId) saveControlSelection({ clientId, objectId })
  }, [clientId, objectId])

  useEffect(() => {
    if (!client) return
    if (inWorkObjects.length === 0) {
      if (objectId) setObjectId('')
      return
    }
    if (!inWorkObjects.some((o) => o.id === objectId)) {
      setObjectId(inWorkObjects[0].id)
    }
  }, [client?.id, inWorkObjects, objectId])

  function goYear(delta: number) {
    setViewYear((y) => {
      const next = y + delta
      if (next > currentYear) return currentYear
      return next
    })
  }

  function pickClient(c: ClientCard) {
    setClientId(c.id)
    const firstInWork = (c.objects ?? []).find((o) => o.inWork) ?? c.objects[0]
    setObjectId(firstInWork?.id ?? '')
  }

  function openPeriodReport() {
    let from = periodFrom
    let to = periodTo
    if (from > to) {
      const t = from
      from = to
      to = t
    }
    // Все объекты «в работе» у клиентов с inWork — не выбранный на экране.
    const qs = new URLSearchParams({ from, to, onlyInWork: '1' })
    navigate(`/control/period-report?${qs.toString()}`)
  }

  function openWeeklyPack() {
    if (!clientId) return
    const { from, to } = fullWeekSatFri()
    const qs = new URLSearchParams({ clientId, from, to })
    if (objectId) qs.set('objectId', objectId)
    navigate(`/control/weekly-pack?${qs.toString()}`)
  }

  useEffect(() => {
    document.title = 'Контроль объекта — СамоСтрой'
  }, [])

  useEffect(() => {
    void runDeadlineNotify({ withinDays: 3 }).catch(() => {
      /* ignore offline / missing channels */
    })
  }, [])

  const canGoForward = viewYear < currentYear

  return (
    <div className="space-y-2">
      {!isForeman && (
        <div className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm">
          <p className="mb-1 text-xs font-medium text-gray-500">
            Сводный отчёт по всем объектам «в работе»
          </p>
          <div className="flex flex-wrap items-end gap-1.5">
            <label className="min-w-0">
              <span className="mb-0.5 block text-[10px] text-gray-500">С</span>
              <input
                type="date"
                className={`${inputCls} w-[9.5rem] tabular-nums`}
                value={periodFrom}
                max={todayIso()}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </label>
            <label className="min-w-0">
              <span className="mb-0.5 block text-[10px] text-gray-500">По</span>
              <input
                type="date"
                className={`${inputCls} w-[9.5rem] tabular-nums`}
                value={periodTo}
                max={todayIso()}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={openPeriodReport}
              disabled={!periodFrom || !periodTo}
              className="inline-flex h-[34px] items-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Сводный отчёт
            </button>
            <button
              type="button"
              onClick={openWeeklyPack}
              disabled={!clientId}
              className="inline-flex h-[34px] items-center rounded-md border border-indigo-300 bg-indigo-50 px-3 text-sm font-medium text-indigo-900 shadow-sm hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={!clientId ? 'Сначала выберите клиента' : undefined}
            >
              Пакет клиенту (сб→пт)
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Сводный — период × все адреса с флагом «в работе» (не только выбранный клиент). «Пакет
            клиенту» — неделя сб→пт по всем объектам «в работе» выбранного клиента (один отчёт).
            Печать/PDF — на странице отчёта. KPI — в шапке.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-1">
          <p className="text-xs font-medium text-gray-500">1. Клиент · в работе</p>
          <p className="text-[11px] tabular-nums text-gray-400">
            {filteredClients.length} / {inWorkClients.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            className={`${inputCls} w-36 min-w-0 shrink sm:w-44`}
            placeholder="ФИО"
            value={qName}
            onChange={(e) => setQName(e.target.value)}
          />
          <input
            className={`${inputCls} w-32 min-w-0 shrink tabular-nums sm:w-40`}
            placeholder="Телефон"
            inputMode="tel"
            value={qPhone}
            onChange={(e) => setQPhone(e.target.value)}
          />
          <select
            className={`${inputCls} min-w-0 flex-1 sm:max-w-xs`}
            value={qChannel}
            onChange={(e) => setQChannel(e.target.value)}
          >
            <option value="">Канал — все</option>
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-1.5 max-h-52 overflow-y-auto rounded-md border border-gray-200">
          {filteredClients.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-500">
              {inWorkClients.length === 0
                ? 'Нет клиентов с объектами «в работе»'
                : 'Никого не найдено по фильтру'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredClients.map((c) => {
                const workCount = (c.objects ?? []).filter((o) => o.inWork).length
                const selected = clientId === c.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickClient(c)}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
                        selected
                          ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                          : 'hover:bg-blue-50/60'
                      }`}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate font-medium ${
                          selected ? 'text-emerald-900' : 'text-gray-900'
                        }`}
                      >
                        {c.name || 'Без имени'}
                      </span>
                      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-800">
                        {workCount} об.
                      </span>
                      <PhoneActions phone={c.mobile} showNumber size="sm" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {client && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-medium text-gray-500">
              2. Объекты в работе
              {inWorkObjects.length > 0 ? (
                <span className="ml-1 font-normal text-gray-400">· {inWorkObjects.length}</span>
              ) : null}
            </p>
            {inWorkObjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Предыдущий год"
                    onClick={() => goYear(-1)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    <RiArrowLeftSLine className="h-4 w-4" />
                  </button>
                  <h2 className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-gray-900">
                    {viewYear}
                  </h2>
                  <button
                    type="button"
                    aria-label="Следующий год"
                    disabled={!canGoForward}
                    onClick={() => goYear(1)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RiArrowRightSLine className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700">
                    нет
                  </span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">
                    есть
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
                    будущее
                  </span>
                </div>
              </div>
            )}
          </div>
          {inWorkObjects.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
              У клиента нет объектов со статусом «в работе».
              <Link
                to={`/clients/${client.id}/main`}
                className="ml-1 font-medium text-blue-700 hover:underline"
              >
                Открыть карточку →
              </Link>
            </div>
          ) : (
            inWorkObjects.map((o) => (
              <ObjectCalendarCard
                key={o.id}
                client={client}
                object={o}
                focused={o.id === objectId}
                onFocus={() => setObjectId(o.id)}
                viewYear={viewYear}
                reportDate={reportDate}
                onReportDate={setReportDate}
                tick={tick}
                onBump={bump}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
