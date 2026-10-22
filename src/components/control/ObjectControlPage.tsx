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
  loadControlSelection,
  saveControlSelection,
  todayIso,
  type ControlLink,
} from '../../lib/objectReports'
import { PhoneActions } from '../ui/PhoneActions'

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

const WEEKDAYS = ['п', 'в', 'с', 'ч', 'п', 'с', 'в']

function MiniMonth({
  year,
  month,
  reported,
  reportDate,
  onPick,
}: {
  year: number
  month: number
  reported: Set<string>
  reportDate: string
  onPick: (date: string, future: boolean) => void
}) {
  const days = useMemo(() => buildMonth(year, month, reported), [year, month, reported])
  const pad = (new Date(year, month, 1).getDay() + 6) % 7

  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-center text-[10px] font-semibold capitalize leading-none text-gray-700">
        {monthShort(month)}
      </p>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[8px] leading-none text-gray-400">
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
            cls = d.hasReport
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }
          if (d.today) cls += ' ring-1 ring-blue-500'
          if (d.date === reportDate) cls += ' outline outline-1 outline-indigo-500'
          return (
            <button
              key={d.date}
              type="button"
              title={d.date}
              onClick={() => onPick(d.date, d.future)}
              className={`flex h-4 w-full items-center justify-center rounded-[2px] text-[9px] font-semibold tabular-nums leading-none ${cls}`}
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
  'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function ObjectControlPage() {
  const navigate = useNavigate()
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
  const [copied, setCopied] = useState(false)

  const filteredClients = useMemo(
    () =>
      clients.filter((c) =>
        matchClientFilters(c, { name: qName, phone: qPhone, channel: qChannel }),
      ),
    [clients, qName, qPhone, qChannel],
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

  const miss = useMemo(
    () => countMissInYear(viewYear, reported),
    [viewYear, reported],
  )

  const shareUrl =
    link && typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/report/${link.token}`
      : ''

  function goYear(delta: number) {
    setViewYear((y) => {
      const next = y + delta
      if (next > currentYear) return currentYear
      return next
    })
  }

  function openReport(date: string) {
    if (!link) return
    navigate(`/report/${link.token}?date=${encodeURIComponent(date)}`)
  }

  function pickClient(c: ClientCard) {
    setClientId(c.id)
    setQName('')
    setQPhone('')
    setQChannel('')
    const first = c.objects[0]
    setObjectId(first?.id ?? '')
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  useEffect(() => {
    document.title = 'Контроль объекта — СамоСтрой'
  }, [])

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!client) return
    if (objects.length === 1 && objectId !== objects[0].id) {
      setObjectId(objects[0].id)
    }
  }, [client?.id, objects.length])

  const showClientList =
    qName.trim().length > 0 || qPhone.trim().length > 0 || qChannel.trim().length > 0 || !client
  const canGoForward = viewYear < currentYear

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-medium text-gray-500">1. Клиент</p>
        <div className="flex flex-wrap items-center gap-2">
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
        {showClientList && (
          <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-gray-200">
            {filteredClients.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-500">Никого не найдено</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredClients.slice(0, 12).map((c) => (
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
              <Link
                to={`/clients/${client.id}/main`}
                className="ml-1 font-medium text-blue-700 hover:underline"
              >
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
          {/* Одна строка: без отчёта + ссылка без карточки */}
          <div className="flex h-8 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="shrink-0 text-xs text-gray-500">
              Без отчёта:{' '}
              <strong className="tabular-nums text-rose-600">{miss}</strong>
            </span>
            <span className="hidden text-gray-300 sm:inline">·</span>
            <span className="min-w-0 flex-1 truncate text-xs text-gray-500" title={shareUrl}>
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
            >
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
            <Link
              to={`/report/${link.token}?date=${encodeURIComponent(reportDate)}`}
              className="shrink-0 text-xs font-medium text-blue-700 hover:underline"
            >
              Форма →
            </Link>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:p-2.5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Предыдущий год"
                  onClick={() => goYear(-1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <RiArrowLeftSLine className="h-4 w-4" />
                </button>
                <h2 className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-gray-900">
                  {viewYear}
                </h2>
                <button
                  type="button"
                  aria-label="Следующий год"
                  disabled={!canGoForward}
                  onClick={() => goYear(1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }, (_, m) => (
                <MiniMonth
                  key={m}
                  year={viewYear}
                  month={m}
                  reported={reported}
                  reportDate={reportDate}
                  onPick={(date, future) => {
                    setReportDate(date)
                    if (!future) openReport(date)
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
