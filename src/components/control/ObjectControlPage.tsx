import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import {
  loadClients,
  matchClientSearch,
  type ClientCard,
  type ClientObject,
} from '../../lib/clients'
import {
  datesWithReports,
  getOrCreateControlLink,
  loadControlSelection,
  saveControlSelection,
  todayIso,
  type ControlLink,
} from '../../lib/objectReports'
import { PhoneActions } from '../ui/PhoneActions'
import { Kpi } from '../ui/Kpi'

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

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function monthTitle(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

const inputCls =
  'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function ObjectControlPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [clients] = useState<ClientCard[]>(() => loadClients())
  const [q, setQ] = useState('')
  const saved = loadControlSelection()
  const [clientId, setClientId] = useState(saved?.clientId ?? '')
  const [objectId, setObjectId] = useState(saved?.objectId ?? '')
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [reportDate, setReportDate] = useState(todayIso())
  const [tick, setTick] = useState(0)

  const filteredClients = useMemo(
    () => clients.filter((c) => matchClientSearch(c, q)),
    [clients, q],
  )

  const client = clients.find((c) => c.id === clientId) ?? null
  const objects: ClientObject[] = client?.objects ?? []
  const object = objects.find((o) => o.id === objectId) ?? null

  const link: ControlLink | null = useMemo(() => {
    if (!client || !object) return null
    return getOrCreateControlLink({
      clientId: client.id,
      objectId: object.id,
      objectTitle: object.title || object.address,
      objectAddress: object.address,
    })
  }, [client, object])

  useEffect(() => {
    if (clientId && objectId) saveControlSelection({ clientId, objectId })
  }, [clientId, objectId])

  const reported = useMemo(() => {
    void tick
    return link ? datesWithReports(link.token) : new Set<string>()
  }, [link?.token, tick])

  const days = useMemo(
    () => buildMonth(viewYear, viewMonth, reported),
    [viewYear, viewMonth, reported],
  )
  const miss = days.filter((d) => !d.future && !d.hasReport).length
  const pad = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7

  const shareUrl =
    link && typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/report/${link.token}`
      : ''

  function goMonth(delta: number) {
    const next = shiftMonth(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
  }

  function openReport(date: string) {
    if (!link) return
    navigate(`/report/${link.token}?date=${encodeURIComponent(date)}`)
  }

  function onPickDate(value: string) {
    if (!value) return
    setReportDate(value)
    const [y, m] = value.split('-').map(Number)
    if (y && m) {
      setViewYear(y)
      setViewMonth(m - 1)
    }
  }

  function pickClient(c: ClientCard) {
    setClientId(c.id)
    setQ('')
    const first = c.objects[0]
    setObjectId(first?.id ?? '')
  }

  useEffect(() => {
    document.title = 'Контроль объекта — СамоСтрой'
  }, [])

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // если у выбранного клиента один объект — автовыбор
  useEffect(() => {
    if (!client) return
    if (objects.length === 1 && objectId !== objects[0].id) {
      setObjectId(objects[0].id)
    }
  }, [client?.id, objects.length])

  const showClientList = q.trim().length > 0 || !client

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-medium text-gray-500">1. Клиент</p>
        <input
          className={inputCls}
          placeholder="Поиск: ФИО или цифры телефона…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {showClientList && (
          <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-gray-200">
            {filteredClients.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-500">Никого не найдено</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredClients.slice(0, 12).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickClient(c)}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm ${
                        clientId === c.id ? 'bg-blue-50' : 'hover:bg-blue-50/60'
                      }`}
                    >
                      <span className="truncate font-medium text-gray-900">
                        {c.name || 'Без имени'}
                      </span>
                      <PhoneActions phone={c.mobile} showNumber size="sm" stopPropagation />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {client && !showClientList && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-sm">
            <span className="font-medium text-emerald-900">{client.name}</span>
            <PhoneActions phone={client.mobile} size="sm" />
            <button
              type="button"
              className="ml-auto text-xs text-emerald-800 hover:underline"
              onClick={() => {
                setClientId('')
                setObjectId('')
              }}
            >
              Сменить
            </button>
          </div>
        )}
      </div>

      {client && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">2. Адрес / договор</p>
          {objects.length === 0 ? (
            <p className="text-sm text-amber-700">
              У клиента нет объектов. Добавьте адрес во вкладке «Контакты» карточки клиента.
              <Link to={`/clients/${client.id}/main`} className="ml-1 font-medium text-blue-700 hover:underline">
                Открыть карточку →
              </Link>
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
                  {o.address || o.title}
                  {o.contractNumber ? ` · дог. ${o.contractNumber}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {link && object && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Kpi label="Объект" value={object.address || object.title} accent="blue" />
            <Kpi label="Без отчёта" value={miss} accent="rose" />
            <div className="flex items-center gap-1.5 rounded-md border border-gray-200 border-l-4 border-l-indigo-500 bg-white px-2.5 py-1.5 shadow-sm">
              <input
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 truncate rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-[11px] text-gray-600"
              />
              <button
                type="button"
                className="shrink-0 rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                onClick={() => void navigator.clipboard.writeText(shareUrl)}
              >
                Copy
              </button>
              <Link
                to={`/report/${link.token}?date=${encodeURIComponent(reportDate)}`}
                className="shrink-0 text-[11px] font-medium text-blue-700 hover:underline"
              >
                Форма →
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm sm:p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Предыдущий месяц"
                  onClick={() => goMonth(-1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <RiArrowLeftSLine className="h-4 w-4" />
                </button>
                <h2 className="min-w-[9.5rem] text-center text-sm font-semibold capitalize text-gray-900">
                  {monthTitle(viewYear, viewMonth)}
                </h2>
                <button
                  type="button"
                  aria-label="Следующий месяц"
                  onClick={() => goMonth(1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1 text-[10px]">
                <span className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700">нет</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">
                  есть
                </span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
                  будущее
                </span>
              </div>

              <div className="ml-auto flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-xs sm:flex-initial">
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => onPickDate(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => openReport(reportDate)}
                  className="shrink-0 rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Записать
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400">
                  {d}
                </div>
              ))}
              {Array.from({ length: pad }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((d) => {
                const dayNum = Number(d.date.slice(-2))
                let cls = 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                if (!d.future) {
                  cls = d.hasReport
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-rose-500 text-white hover:bg-rose-600'
                }
                if (d.today) cls += ' ring-1 ring-offset-1 ring-blue-500'
                if (d.date === reportDate) cls += ' outline outline-1 outline-offset-0 outline-indigo-500'
                return (
                  <button
                    key={d.date}
                    type="button"
                    title={
                      d.hasReport
                        ? `${d.date}: отчёт есть`
                        : d.future
                          ? `${d.date}: будущее`
                          : `${d.date}: нет отчёта`
                    }
                    onClick={() => {
                      setReportDate(d.date)
                      if (!d.future) openReport(d.date)
                    }}
                    className={`flex aspect-square items-center justify-center rounded text-xs font-semibold tabular-nums ${cls}`}
                  >
                    {dayNum}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
