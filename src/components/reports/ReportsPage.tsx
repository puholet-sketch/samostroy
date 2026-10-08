import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { DailyReport, FunnelEvent, User } from '../../services/types'
import { useObjects } from '../../hooks/useObjects'

const FUNNEL_ORDER = ['lead', 'discovery', 'design', 'contract', 'production']
const FUNNEL_LABEL: Record<string, string> = {
  lead: 'Лид',
  discovery: 'Discovery',
  design: 'Дизайн',
  contract: 'Договор',
  production: 'Производство',
}

export default function ReportsPage() {
  const { can } = useAuth()
  const { objects } = useObjects()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [events, setEvents] = useState<FunnelEvent[]>([])

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
    return [...map.entries()].map(([authorId, count]) => ({
      name: users.find((u) => u.id === authorId)?.name ?? authorId,
      count,
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
    return FUNNEL_ORDER.map((s) => ({
      stage: FUNNEL_LABEL[s] ?? s,
      count: byStage.get(s) ?? 0,
    }))
  }, [objects, events])

  const colors = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Отчёты</h1>
        <p className="text-sm text-gray-500 mt-1">Ops (кто сдал дневной отчёт) и воронка продаж — stubs с живыми данными seed</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {can('reports_ops') && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Ops: сданные дневные отчёты</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={opsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {opsData.length === 0 && <p className="text-sm text-gray-500">Пока нет сданных отчётов</p>}
          </div>
        )}

        {can('reports_sales') && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Воронка продаж</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-2">События воронки: {events.length} (funnel_events.json)</p>
          </div>
        )}
      </div>

      {!can('reports_ops') && !can('reports_sales') && (
        <div className="card p-8 text-center text-gray-500">Нет доступа к отчётам</div>
      )}
    </div>
  )
}
