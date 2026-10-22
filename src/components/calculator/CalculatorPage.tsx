import { useEffect, useMemo, useState } from 'react'
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import priceList from '@data/price_list.json'
import {
  buildLinesFromQty,
  loadCalcTransfer,
  saveCalcTransfer,
} from '../../lib/calcTransfer'
import { usePageHeaderActions } from '../../contexts/PageHeaderContext'
import { Kpi, Panel } from '../ui/Kpi'

type PriceItem = {
  section: string
  name: string
  unit: string
  price: number
}

type QtyMap = Record<string, number>

const STORAGE_KEY = 'samostroy:calc_qty_v1'
const SECTION_KEY = 'samostroy:calc_section_v1'

const items: PriceItem[] = (priceList.items ?? []).map((it) => ({
  section: it.section || 'Прочее',
  name: it.name,
  unit: it.unit || 'шт',
  price: Number(it.price) || 0,
}))

function itemKey(it: PriceItem, idx: number) {
  return `${it.section}::${idx}::${it.name}`
}

function loadQty(): QtyMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as QtyMap
  } catch {
    /* ignore */
  }
  return {}
}

function loadSection(fallback: string): string {
  try {
    const raw = localStorage.getItem(SECTION_KEY)
    if (raw) return raw
  } catch {
    /* ignore */
  }
  return fallback
}

function money(n: number) {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

const inputCls =
  'w-24 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function CalculatorPage() {
  const [qty, setQty] = useState<QtyMap>(() => loadQty())
  const [q, setQ] = useState('')
  const [onlyFilled, setOnlyFilled] = useState(false)
  const transferInit = loadCalcTransfer()
  const [transferToRemont, setTransferToRemont] = useState(transferInit.transferToRemont)
  const [withDetails, setWithDetails] = useState(transferInit.withDetails)

  const sections = useMemo(() => {
    const map = new Map<string, { it: PriceItem; idx: number }[]>()
    items.forEach((it, idx) => {
      const list = map.get(it.section) ?? []
      list.push({ it, idx })
      map.set(it.section, list)
    })
    return [...map.entries()]
  }, [])

  const sectionNames = useMemo(() => sections.map(([name]) => name), [sections])

  const [activeSection, setActiveSection] = useState(() =>
    loadSection(sectionNames[0] ?? ''),
  )

  useEffect(() => {
    document.title = 'Калькулятор — СамоСтрой'
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(qty))
  }, [qty])

  useEffect(() => {
    if (!activeSection || !sectionNames.includes(activeSection)) {
      setActiveSection(sectionNames[0] ?? '')
      return
    }
    localStorage.setItem(SECTION_KEY, activeSection)
  }, [activeSection, sectionNames])

  const search = q.trim().toLowerCase()

  const { total, filledCount, sectionTotals, sectionFilled, lines } = useMemo(() => {
    let totalSum = 0
    let filled = 0
    const st: Record<string, number> = {}
    const sf: Record<string, number> = {}
    items.forEach((it, idx) => {
      const key = itemKey(it, idx)
      const n = Number(qty[key]) || 0
      if (n > 0) {
        filled += 1
        const line = n * it.price
        totalSum += line
        st[it.section] = (st[it.section] ?? 0) + line
        sf[it.section] = (sf[it.section] ?? 0) + 1
      }
    })
    const built = buildLinesFromQty(items, qty, itemKey)
    return {
      total: totalSum,
      filledCount: filled,
      sectionTotals: st,
      sectionFilled: sf,
      lines: built.lines,
    }
  }, [qty])

  useEffect(() => {
    saveCalcTransfer({
      transferToRemont,
      withDetails: transferToRemont ? withDetails : false,
      total,
      lines,
      updatedAt: new Date().toISOString(),
    })
  }, [transferToRemont, withDetails, total, lines])

  /** Категории, видимые при поиске / «только с объёмом» */
  const visibleSectionNames = useMemo(() => {
    return sectionNames.filter((section) => {
      const rows = sections.find(([n]) => n === section)?.[1] ?? []
      return rows.some(({ it, idx }) => {
        const key = itemKey(it, idx)
        const n = Number(qty[key]) || 0
        if (onlyFilled && n <= 0) return false
        if (!search) return true
        return (
          it.name.toLowerCase().includes(search) || section.toLowerCase().includes(search)
        )
      })
    })
  }, [sectionNames, sections, qty, onlyFilled, search])

  useEffect(() => {
    if (visibleSectionNames.length === 0) return
    if (!visibleSectionNames.includes(activeSection)) {
      setActiveSection(visibleSectionNames[0])
    }
  }, [visibleSectionNames, activeSection])

  const activeIdx = visibleSectionNames.indexOf(activeSection)
  const activeRows = useMemo(() => {
    const rows = sections.find(([n]) => n === activeSection)?.[1] ?? []
    return rows.filter(({ it, idx }) => {
      const key = itemKey(it, idx)
      const n = Number(qty[key]) || 0
      if (onlyFilled && n <= 0) return false
      if (!search) return true
      return (
        it.name.toLowerCase().includes(search) ||
        activeSection.toLowerCase().includes(search)
      )
    })
  }, [sections, activeSection, qty, onlyFilled, search])

  function setItemQty(key: string, value: string) {
    const n = value === '' ? 0 : Number(value.replace(',', '.'))
    setQty((prev) => {
      const next = { ...prev }
      if (!n || Number.isNaN(n)) delete next[key]
      else next[key] = n
      return next
    })
  }

  function goSection(delta: number) {
    if (visibleSectionNames.length === 0) return
    const i = Math.max(0, activeIdx)
    const next = (i + delta + visibleSectionNames.length) % visibleSectionNames.length
    setActiveSection(visibleSectionNames[next])
  }

  usePageHeaderActions(null)

  const secTotal = sectionTotals[activeSection] ?? 0
  const secFilled = sectionFilled[activeSection] ?? 0

  const btnBase =
    'inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-sm font-medium'

  return (
    <div className="space-y-4 pb-28">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => goSection(-1)}
          disabled={visibleSectionNames.length < 2}
          className={`${btnBase} border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40`}
        >
          ← Категория
        </button>
        <button
          type="button"
          onClick={() => goSection(1)}
          disabled={visibleSectionNames.length < 2}
          className={`${btnBase} border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40`}
        >
          Категория →
        </button>
        <button
          type="button"
          onClick={() => setQty({})}
          className={`${btnBase} border-red-200 bg-white text-red-600 hover:bg-red-50`}
        >
          Сбросить
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Позиций" value={items.length} accent="blue" />
        <Kpi label="Заполнено" value={filledCount} accent="emerald" />
        <Kpi label="Итого" value={`${money(total)} ₽`} accent="indigo" />
      </div>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="block w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Поиск по названию работы…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={onlyFilled}
              onChange={(e) => setOnlyFilled(e.target.checked)}
            />
            Только с объёмом
          </label>
        </div>
      </Panel>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Переключатель категорий */}
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 sm:px-4">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Предыдущая категория"
              onClick={() => goSection(-1)}
              disabled={visibleSectionNames.length < 2}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              <RiArrowLeftSLine className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {activeSection || 'Нет категорий'}
              </p>
              <p className="text-xs text-gray-500">
                {activeIdx >= 0 ? activeIdx + 1 : 0} / {visibleSectionNames.length || 0}
                {activeRows.length ? ` · ${activeRows.length} поз.` : ''}
                {secFilled > 0 ? ` · заполнено ${secFilled}` : ''}
                {secTotal > 0 ? ` · ${money(secTotal)} ₽` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label="Следующая категория"
              onClick={() => goSection(1)}
              disabled={visibleSectionNames.length < 2}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              <RiArrowRightSLine className="h-5 w-5" />
            </button>
          </div>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
            {visibleSectionNames.map((name) => {
              const active = name === activeSection
              const sum = sectionTotals[name] ?? 0
              const filled = sectionFilled[name] ?? 0
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveSection(name)}
                  title={name}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-blue-50'
                  }`}
                >
                  <span className="block max-w-[11rem] truncate">{name}</span>
                  {(filled > 0 || sum > 0) && (
                    <span
                      className={`mt-0.5 block tabular-nums ${
                        active ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      {filled > 0 ? `${filled} · ` : ''}
                      {sum > 0 ? `${money(sum)} ₽` : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {activeRows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            В этой категории ничего не найдено
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-white text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Работа</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Ед.</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Цена</th>
                  <th className="w-40 whitespace-nowrap px-3 py-2 font-medium">Объём</th>
                  <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeRows.map(({ it, idx }) => {
                  const key = itemKey(it, idx)
                  const n = Number(qty[key]) || 0
                  const line = n * it.price
                  return (
                    <tr key={key} className={n > 0 ? 'bg-emerald-50/60' : 'bg-white'}>
                      <td className="max-w-xl px-4 py-2.5 text-gray-800">{it.name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{it.unit}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {money(it.price)} ₽
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className={inputCls}
                            value={n || ''}
                            placeholder="0"
                            onChange={(e) => setItemQty(key, e.target.value)}
                          />
                          <span className="whitespace-nowrap text-xs text-gray-400">{it.unit}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                        {n > 0 ? `${money(line)} ₽` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-gray-500">Итого по смете</p>
              <p className="text-lg font-semibold text-gray-900">{money(total)} ₽</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={transferToRemont}
                onChange={(e) => {
                  const on = e.target.checked
                  setTransferToRemont(on)
                  if (!on) setWithDetails(false)
                }}
              />
              перенести сумму в договор на ремонт
            </label>
            <label
              className={`inline-flex items-center gap-2 text-sm ${
                transferToRemont ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={withDetails}
                disabled={!transferToRemont}
                onChange={(e) => {
                  const on = e.target.checked
                  setWithDetails(on)
                  if (on) setTransferToRemont(true)
                }}
              />
              перенести с детализацией
            </label>
          </div>
          <p className="text-sm text-gray-500">
            Заполнено: {filledCount} из {items.length}
          </p>
        </div>
      </div>
    </div>
  )
}
