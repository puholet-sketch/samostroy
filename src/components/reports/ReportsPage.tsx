import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { DailyReport, FunnelEvent, User } from '../../services/types'
import { useObjects } from '../../hooks/useObjects'
import { computeFinance, formatPct, formatRub } from './financeMetrics'

const FUNNEL_ORDER = ['lead', 'discovery', 'design', 'contract', 'production']
const FUNNEL_LABEL: Record<string, string> = {
  lead: 'Лид',
  discovery: 'Discovery',
  design: 'Дизайн',
  contract: 'Договор',
  production: 'Производство',
}

/** Distinct multi-color palette (not monochrome blue). */
const CHART_COLORS = ['#0d9488', '#f59e0b', '#8b5cf6', '#ef4444', '#2563eb', '#10b981', '#f97316']

function ChartSwatchLegend({
  items,
}: {
  items: { label: string; color: string; value?: string }[]
}) {
  if (items.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-2 text-xs text-gray-600">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span>
            {item.label}
            {item.value != null && (
              <span className="text-gray-400"> · {item.value}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  )
}

export default function ReportsPage() {
  const { can } = useAuth()
  const { objects } = useObjects()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [events, setEvents] = useState<FunnelEvent[]>([])

  const showOps = can('reports_ops')
  const showSales = can('reports_sales')
  const showFinance = can('reports_finance')
  const hasAny = showOps || showSales || showFinance

  useEffect(() => {
    void (async () => {
      const dr = await api.dailyReports.get()
      setReports(dr.reports)
      setUsers(await api.users.list())
      setEvents(await api.funnel.list())
    })()
  }, [])

  const opsData = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of reports.filter((x) => x.status === 'submitted' || x.status === 'late')) {
      map.set(r.authorId, (map.get(r.authorId) ?? 0) + 1)
    }
    return [...map.entries()].map(([authorId, count], i) => ({
      name: users.find((u) => u.id === authorId)?.name ?? authorId,
      count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [reports, users])

  const funnelData = useMemo(() => {
    const byStage = new Map<string, number>()
    for (const s of FUNNEL_ORDER) byStage.set(s, 0)
    for (const o of objects) {
      const st =
        o.status === 'in_progress' || o.status === 'done'
          ? 'production'
          : o.status === 'contract'
            ? 'contract'
            : o.status === 'design'
              ? 'design'
              : 'lead'
      byStage.set(st, (byStage.get(st) ?? 0) + 1)
    }
    for (const e of events) {
      if (!byStage.has(e.stage)) byStage.set(e.stage, 0)
    }
    return FUNNEL_ORDER.map((s, i) => ({
      stage: FUNNEL_LABEL[s] ?? s,
      count: byStage.get(s) ?? 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [objects, events])

  const finance = useMemo(() => computeFinance(objects), [objects])

  const financeChartData = useMemo(
    () =>
      finance.rows.map((r) => ({
        name: r.title.length > 22 ? `${r.title.slice(0, 20)}…` : r.title,
        plan: r.planned,
        paid: r.paid,
      })),
    [finance.rows],
  )

  const subtitleParts: string[] = []
  if (showOps) subtitleParts.push('ops')
  if (showSales) subtitleParts.push('воронка')
  if (showFinance) subtitleParts.push('финансы по этапам и оплатам')
  const subtitle =
    subtitleParts.length > 0
      ? `Сводка: ${subtitleParts.join(' · ')}. Расчёты по seed-данным объектов.`
      : ''

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Отчёты</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      {(showOps || showSales) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {showOps && (
            <div className="card p-5 flex flex-col min-h-[360px]">
              <h2 className="font-semibold text-gray-900 mb-4">Ops: сданные дневные отчёты</h2>
              <div className="h-64 grow">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={opsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [value ?? 0, 'Отчётов']}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="count" name="Сдано" radius={[4, 4, 0, 0]}>
                      {opsData.map((row) => (
                        <Cell key={row.name} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartSwatchLegend
                items={opsData.map((r) => ({
                  label: r.name,
                  color: r.color,
                  value: String(r.count),
                }))}
              />
              {opsData.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">Пока нет сданных отчётов</p>
              )}
            </div>
          )}

          {showSales && (
            <div className="card p-5 flex flex-col min-h-[360px]">
              <h2 className="font-semibold text-gray-900 mb-4">Воронка продаж</h2>
              <div className="h-64 grow">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [value ?? 0, 'Объектов']}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="count" name="Объектов" radius={[4, 4, 0, 0]}>
                      {funnelData.map((row) => (
                        <Cell key={row.stage} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartSwatchLegend
                items={funnelData.map((r) => ({
                  label: r.stage,
                  color: r.color,
                  value: String(r.count),
                }))}
              />
              <p className="text-xs text-gray-400 mt-2">
                События воронки: {events.length} (funnel_events.json)
              </p>
            </div>
          )}
        </div>
      )}

      {showFinance && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Финансы</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Итого по всем объектам и разрез по объектам (план / оплаты / акты этапов)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label="Собрано / оплачено" value={formatRub(finance.paid)} />
            <KpiCard label="План (все этапы)" value={formatRub(finance.planned)} />
            <KpiCard label="Остаток к оплате" value={formatRub(finance.remaining)} />
            <KpiCard
              label="Актов закрыто"
              value={`${finance.actsClosed}`}
              hint={`из ${finance.stagesTotal} этапов`}
            />
            <KpiCard label="% оплаты от плана" value={formatPct(finance.pctPaid)} />
            <KpiCard
              label="Ср. оплата / акт"
              value={formatRub(finance.avgPaidPerClosedAct)}
              hint={`закрыто актов: ${formatPct(finance.pctActsClosed)}`}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
            <div className="card p-5 flex flex-col min-h-[320px]">
              <h3 className="font-semibold text-gray-900 mb-4">План vs оплачено по объектам</h3>
              <div className="h-64 grow">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financeChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : v >= 1000
                            ? `${Math.round(v / 1000)}k`
                            : String(v)
                      }
                      width={48}
                    />
                    <Tooltip
                      formatter={(value) => formatRub(typeof value === 'number' ? value : Number(value) || 0)}
                    />
                    <Legend
                      formatter={(value) => (value === 'plan' ? 'План' : value === 'paid' ? 'Оплачено' : value)}
                    />
                    <Bar dataKey="plan" name="plan" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="paid" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartSwatchLegend
                items={[
                  { label: 'План', color: '#8b5cf6' },
                  { label: 'Оплачено', color: '#0d9488' },
                ]}
              />
            </div>

            <div className="card p-4 sm:p-5 table-scroll min-h-[320px]">
              <h3 className="font-semibold text-gray-900 mb-4">В разрезе объектов</h3>
              <table className="min-w-[560px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="pb-2 pr-3 font-medium">Объект</th>
                    <th className="pb-2 pr-3 font-medium whitespace-nowrap">План</th>
                    <th className="pb-2 pr-3 font-medium whitespace-nowrap">Оплачено</th>
                    <th className="pb-2 pr-3 font-medium whitespace-nowrap">Остаток</th>
                    <th className="pb-2 pr-3 font-medium whitespace-nowrap">Акты</th>
                    <th className="pb-2 font-medium whitespace-nowrap">% оплаты</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.rows.map((r) => (
                    <tr key={r.objectId} className="border-t border-gray-50">
                      <td className="py-2.5 pr-3 font-medium text-gray-900 max-w-[14rem]">
                        {r.title}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-gray-700 whitespace-nowrap">
                        {formatRub(r.planned)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-teal-700 whitespace-nowrap">
                        {formatRub(r.paid)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-gray-600 whitespace-nowrap">
                        {formatRub(r.remaining)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-gray-700 whitespace-nowrap">
                        {r.actsClosed}/{r.stagesTotal}
                      </td>
                      <td className="py-2.5 tabular-nums font-medium text-gray-900 whitespace-nowrap">
                        {formatPct(r.pctPaid)}
                      </td>
                    </tr>
                  ))}
                  {finance.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        Нет объектов для финансового отчёта
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {!hasAny && (
        <div className="card p-8 text-center text-gray-500">Нет доступа к отчётам</div>
      )}
    </div>
  )
}
