import { useEffect, useMemo, useState } from 'react'
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

  usePageHeaderActions(null)

  const sections = useMemo(() => {
    const map = new Map<string, { it: PriceItem; idx: number }[]>()
    items.forEach((it, idx) => {
      const list = map.get(it.section) ?? []
      list.push({ it, idx })
      map.set(it.section, list)
    })
    return [...map.entries()]
  }, [])

  useEffect(() => {
    document.title = 'Калькулятор — СамоСтрой'
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(qty))
  }, [qty])

  const search = q.trim().toLowerCase()

  const { total, filledCount, lines } = useMemo(() => {
    let totalSum = 0
    let filled = 0
    items.forEach((it, idx) => {
      const key = itemKey(it, idx)
      const n = Number(qty[key]) || 0
      if (n > 0) {
        filled += 1
        totalSum += n * it.price
      }
    })
    const built = buildLinesFromQty(items, qty, itemKey)
    return {
      total: totalSum,
      filledCount: filled,
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

  const visibleSections = useMemo(() => {
    return sections
      .map(([section, rows]) => {
        const visible = rows.filter(({ it, idx }) => {
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
  }, [sections, qty, onlyFilled, search])

  function setItemQty(key: string, value: string) {
    const n = value === '' ? 0 : Number(value.replace(',', '.'))
    setQty((prev) => {
      const next = { ...prev }
      if (!n || Number.isNaN(n)) delete next[key]
      else next[key] = n
      return next
    })
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Позиций" value={items.length} accent="blue" />
        <Kpi label="Заполнено" value={filledCount} accent="emerald" />
        <Kpi label="Итого" value={`${money(total)} ₽`} accent="indigo" />
        <button
          type="button"
          onClick={() => setQty({})}
          className="flex items-center justify-center rounded-md border border-red-200 border-l-4 border-l-red-500 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
        >
          Сбросить
        </button>
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

      {visibleSections.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
          Ничего не найдено
        </p>
      ) : (
        <div className="space-y-4">
          {visibleSections.map(([section, rows]) => (
            <div
              key={section}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <p className="text-sm font-semibold text-gray-900">{section}</p>
                <p className="text-xs text-gray-500">{rows.length} поз.</p>
              </div>
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
                    {rows.map(({ it, idx }) => {
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
          ))}
        </div>
      )}

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
