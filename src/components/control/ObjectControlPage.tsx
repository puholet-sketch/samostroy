import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import {
  datesWithReports,
  getOrCreateControlLink,
  todayIso,
} from '../../lib/objectReports'
import { Kpi, Panel } from '../ui/Kpi'

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

export default function ObjectControlPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [reportDate, setReportDate] = useState(todayIso())
  const [link] = useState(() => getOrCreateControlLink())
  const [tick, setTick] = useState(0)

  const reported = useMemo(() => {
    void tick
    return datesWithReports(link.token)
  }, [link.token, tick])

  const days = useMemo(
    () => buildMonth(viewYear, viewMonth, reported),
    [viewYear, viewMonth, reported],
  )
  const miss = days.filter((d) => !d.future && !d.hasReport).length
  const pad = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/report/${link.token}`
      : `/report/${link.token}`

  function goMonth(delta: number) {
    const next = shiftMonth(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
  }

  function openReport(date: string) {
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

  useEffect(() => {
    document.title = 'Контроль объекта — СамоСтрой'
  }, [])

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Объект" value={link.objectAddress} accent="blue" />
        <Kpi label="Без отчёта" value={miss} accent="rose" />
        <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 border-l-4 border-l-indigo-500 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
            />
            <button
              type="button"
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
            >
              Copy
            </button>
          </div>
          <Link
            to={`/report/${link.token}?date=${encodeURIComponent(reportDate)}`}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            Открыть форму отчёта →
          </Link>
        </div>
      </div>

      <Panel>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => goMonth(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <RiArrowLeftSLine className="h-5 w-5" />
            </button>
            <h2 className="min-w-[11rem] text-center text-base font-semibold capitalize text-gray-900">
              {monthTitle(viewYear, viewMonth)}
            </h2>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => goMonth(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <RiArrowRightSLine className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-rose-100 px-2 py-1 font-medium text-rose-700">нет отчёта</span>
            <span className="rounded-md bg-emerald-100 px-2 py-1 font-medium text-emerald-700">
              есть отчёт
            </span>
            <span className="rounded-md bg-gray-100 px-2 py-1 font-medium text-gray-600">будущее</span>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className="mb-0.5 block text-[11px] font-medium text-gray-500">Дата отчёта</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => onPickDate(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={() => openReport(reportDate)}
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Записать отчёт
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400">
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
            if (d.today) cls += ' ring-2 ring-offset-1 ring-blue-500'
            if (d.date === reportDate) cls += ' outline outline-2 outline-offset-1 outline-indigo-500'
            return (
              <button
                key={d.date}
                type="button"
                title={
                  d.hasReport
                    ? 'Есть отчёт — открыть / дополнить'
                    : d.future
                      ? 'Будущая дата — можно записать заранее'
                      : 'Нет отчёта — записать'
                }
                onClick={() => {
                  setReportDate(d.date)
                  openReport(d.date)
                }}
                className={`flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${cls}`}
              >
                {dayNum}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Клик по дню или кнопка «Записать отчёт» открывает форму на выбранную дату.
        </p>
      </Panel>
    </div>
  )
}
