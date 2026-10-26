import { useEffect, useMemo, useState } from 'react'
import priceList from '@data/price_list.json'
import {
  applyDiscount,
  buildLinesFromQty,
  loadCalcTransfer,
  saveCalcTransfer,
} from '../../lib/calcTransfer'
import { usePageHeaderActions } from '../../contexts/PageHeaderContext'
import { Panel } from '../ui/Kpi'

type FinishKind = 'chernovye' | 'chistovye' | 'both'

type PriceItem = {
  section: string
  name: string
  unit: string
  price: number
  kind: FinishKind
}

type QtyMap = Record<string, number>
type SectionMode = 'chernovye' | 'all' | 'chistovye'
type SectionModes = Record<string, SectionMode>

const STORAGE_KEY = 'samostroy:calc_qty_v1'
const SECTION_KEY = 'samostroy:calc_section_v1'
const MODES_KEY = 'samostroy:calc_section_modes_v1'
const DISCOUNT_KEY = 'samostroy:calc_discount_v1'
const DEFAULT_SECTION_MODE: SectionMode = 'all'
const SECTION_MODES: SectionMode[] = ['chernovye', 'all', 'chistovye']

function isSectionMode(v: unknown): v is SectionMode {
  return typeof v === 'string' && (SECTION_MODES as string[]).includes(v)
}

const CANON_ORDER: string[] =
  (priceList as { section_order?: string[] }).section_order ?? [
    'ДЕМОНТАЖНЫЕ РАБОТЫ',
    'ПОЛЫ',
    'СТЕНЫ',
    'ПОТОЛКИ',
    'ЭЛЕКТРИКА',
    'САНТЕХНИКА',
    'ПРОЧЕЕ',
  ]

const items: PriceItem[] = (priceList.items ?? []).map((it) => ({
  section: it.section || 'Прочее',
  name: it.name,
  unit: it.unit || 'шт',
  price: Number(it.price) || 0,
  kind: (it as { kind?: FinishKind }).kind || 'both',
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

function loadModes(): SectionModes {
  try {
    const raw = localStorage.getItem(MODES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: SectionModes = {}
    for (const [section, mode] of Object.entries(parsed)) {
      if (isSectionMode(mode)) out[section] = mode
    }
    return out
  } catch {
    /* ignore */
  }
  return {}
}

function loadDiscount(): number {
  try {
    const raw = localStorage.getItem(DISCOUNT_KEY)
    if (raw != null) return Math.max(0, Math.min(100, Number(raw) || 0))
  } catch {
    /* ignore */
  }
  return loadCalcTransfer().discountPct || 0
}

function money(n: number) {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function prettySection(name: string): string {
  const map: Record<string, string> = {
    'ДЕМОНТАЖНЫЕ РАБОТЫ': 'Демонтаж',
    ПОЛЫ: 'Полы',
    СТЕНЫ: 'Стены',
    ПОТОЛКИ: 'Потолки',
    ЭЛЕКТРИКА: 'Электрика',
    САНТЕХНИКА: 'Сантехника',
    ПРОЧЕЕ: 'Прочее',
  }
  return map[name] || name
}

function matchesKind(itemKind: FinishKind, mode: SectionMode): boolean {
  if (mode === 'all') return true
  if (itemKind === 'both') return true
  return itemKind === mode
}

const inputCls =
  'w-24 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
const discountInputCls =
  'w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function CalculatorPage() {
  const [qty, setQty] = useState<QtyMap>(() => loadQty())
  const [q, setQ] = useState('')
  const [onlyFilled, setOnlyFilled] = useState(false)
  const [sectionModes, setSectionModes] = useState<SectionModes>(() => loadModes())
  const [discountPct, setDiscountPct] = useState(() => loadDiscount())
  const transferInit = loadCalcTransfer()
  const [transferToRemont, setTransferToRemont] = useState(transferInit.transferToRemont)
  const [withDetails, setWithDetails] = useState(transferInit.withDetails)

  usePageHeaderActions(null)

  const sections = useMemo(() => {
    const map = new Map<string, { it: PriceItem; idx: number }[]>()
    items.forEach((it, idx) => {
      const list = map.get(it.section) ?? []
      list.push({ it, idx })
      map.set(it.section, list)
    })
    const entries = [...map.entries()]
    entries.sort(([a], [b]) => {
      const ia = CANON_ORDER.indexOf(a)
      const ib = CANON_ORDER.indexOf(b)
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
    })
    return entries
  }, [])

  const sectionNames = useMemo(() => sections.map(([name]) => name), [sections])

  const [activeSection, setActiveSection] = useState(() =>
    loadSection(sectionNames[0] ?? 'Прочее'),
  )

  useEffect(() => {
    document.title = 'Калькулятор — СамоСтрой'
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(qty))
  }, [qty])

  useEffect(() => {
    localStorage.setItem(SECTION_KEY, activeSection)
  }, [activeSection])

  useEffect(() => {
    localStorage.setItem(MODES_KEY, JSON.stringify(sectionModes))
  }, [sectionModes])

  useEffect(() => {
    localStorage.setItem(DISCOUNT_KEY, String(discountPct))
  }, [discountPct])

  const search = q.trim().toLowerCase()
  const activeMode: SectionMode = sectionModes[activeSection] ?? DEFAULT_SECTION_MODE

  const { baseTotal, filledCount, lines } = useMemo(() => {
    let filled = 0
    items.forEach((it, idx) => {
      const n = Number(qty[itemKey(it, idx)]) || 0
      if (n > 0) filled += 1
    })
    const built = buildLinesFromQty(items, qty, (it, idx) =>
      itemKey({ ...it, kind: it.kind ?? 'both' }, idx),
    )
    return {
      baseTotal: built.total,
      filledCount: filled,
      lines: built.lines,
    }
  }, [qty])

  const { total, discountSum } = useMemo(
    () => applyDiscount(baseTotal, discountPct),
    [baseTotal, discountPct],
  )

  useEffect(() => {
    saveCalcTransfer({
      transferToRemont,
      withDetails: transferToRemont ? withDetails : false,
      total,
      baseTotal,
      discountPct,
      lines,
      updatedAt: new Date().toISOString(),
    })
  }, [transferToRemont, withDetails, total, baseTotal, discountPct, lines])

  const filteredSections = useMemo(() => {
    return sections
      .map(([section, rows]) => {
        const mode = sectionModes[section] ?? DEFAULT_SECTION_MODE
        const visible = rows.filter(({ it, idx }) => {
          if (!matchesKind(it.kind, mode)) return false
          const key = itemKey(it, idx)
          const n = Number(qty[key]) || 0
          if (onlyFilled && n <= 0) return false
          if (!search) return true
          return (
            it.name.toLowerCase().includes(search) || section.toLowerCase().includes(search)
          )
        })
        return [section, visible] as const
      })
      .filter(([, visible]) => visible.length > 0)
  }, [sections, qty, onlyFilled, search, sectionModes])

  const filteredNames = useMemo(
    () => filteredSections.map(([name]) => name),
    [filteredSections],
  )

  useEffect(() => {
    if (filteredNames.length === 0) return
    if (!filteredNames.includes(activeSection)) {
      setActiveSection(filteredNames[0])
    }
  }, [filteredNames, activeSection])

  const activeRows =
    filteredSections.find(([name]) => name === activeSection)?.[1] ?? []

  function setItemQty(key: string, value: string) {
    const n = value === '' ? 0 : Number(value.replace(',', '.'))
    setQty((prev) => {
      const next = { ...prev }
      if (!n || Number.isNaN(n)) delete next[key]
      else next[key] = n
      return next
    })
  }

  function setMode(section: string, mode: SectionMode) {
    setSectionModes((prev) => ({ ...prev, [section]: mode }))
  }

  return (
    <div className="space-y-4 pb-28">
      <Panel>
        <input
          className="block w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Поиск по названию работы…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {discountPct > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            База {money(baseTotal)} ₽ · скидка −{money(discountSum)} ₽ · к оплате {money(total)} ₽
            (уйдёт в смету и договор)
          </p>
        )}
      </Panel>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {filteredSections.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Ничего не найдено</p>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            {/* Sections: vertical list — no horizontal chip scroll */}
            <nav
              className="shrink-0 border-b border-gray-200 bg-gray-50 lg:w-52 lg:border-b-0 lg:border-r"
              aria-label="Разделы сметы"
            >
              <p className="hidden px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 lg:block">
                Разделы
              </p>
              <ul className="flex flex-col gap-0.5 p-2 lg:max-h-[min(70vh,36rem)] lg:overflow-y-auto">
                {filteredNames.map((name) => {
                  const count =
                    filteredSections.find(([s]) => s === name)?.[1].length ?? 0
                  const active = name === activeSection
                  return (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => setActiveSection(name)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-white hover:text-gray-900'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className="min-w-0 truncate">{prettySection(name)}</span>
                        <span
                          className={`shrink-0 tabular-nums text-xs ${
                            active ? 'text-blue-100' : 'text-gray-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="min-w-0 flex-1">
              <div className="space-y-3 border-b border-gray-100 px-4 py-3">
                <h2 className="text-base font-semibold text-gray-900">
                  {prettySection(activeSection)}
                </h2>

                <div
                  className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs"
                  role="group"
                  aria-label="Тип работ"
                >
                  {(
                    [
                      { id: 'chernovye', label: 'Черновые' },
                      { id: 'all', label: 'Все' },
                      { id: 'chistovye', label: 'Чистовые' },
                    ] as const
                  ).map(({ id, label }) => {
                    const on = activeMode === id
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setMode(activeSection, id)}
                        className={`rounded-md px-2.5 py-1.5 font-semibold transition-colors ${
                          on
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-500 hover:bg-white/70 hover:text-gray-800'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                    <span className="whitespace-nowrap">Скидка %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className={discountInputCls}
                      value={discountPct || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setDiscountPct(
                          Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        )
                      }
                    />
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={onlyFilled}
                      onChange={(e) => setOnlyFilled(e.target.checked)}
                    />
                    <span className="whitespace-nowrap">Только с объёмом</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setQty({})}
                    className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Сбросить
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-white text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Работа</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Ед.</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        Цена
                      </th>
                      <th className="w-40 whitespace-nowrap px-3 py-2 font-medium">Объём</th>
                      <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        Сумма
                      </th>
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
                          <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                            {it.unit}
                          </td>
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
                              <span className="whitespace-nowrap text-xs text-gray-400">
                                {it.unit}
                              </span>
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
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-gray-500">
                {discountPct > 0 ? `Итого (−${discountPct}%)` : 'Итого по смете'}
              </p>
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
