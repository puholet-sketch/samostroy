import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { DailyReportsData } from '../../services/types'
import { useObjects } from '../../hooks/useObjects'

export default function DailyReportsPage() {
  const { user, can } = useAuth()
  const { objects } = useObjects()
  const [data, setData] = useState<DailyReportsData | null>(null)
  const writable = can('daily_reports', 'write')

  useEffect(() => {
    void api.dailyReports.get().then(setData)
  }, [])

  if (!data) return <div className="text-gray-500">Загрузка…</div>

  const objectTitle = (id: string) => objects.find((o) => o.id === id)?.title ?? id
  const isClient = user?.role === 'client'
  const reports = isClient
    ? data.reports.filter((r) => r.clientVisible && objects.some((o) => o.id === r.objectId))
    : data.reports.filter((r) => objects.some((o) => o.id === r.objectId) || user?.role === 'owner')

  async function submitDraft(id: string) {
    if (!writable || !data) return
    const now = new Date()
    const [hh, mm] = data.deadlineLocal.split(':').map(Number)
    const deadline = new Date(now)
    deadline.setHours(hh, mm, 0, 0)
    const late = now > deadline
    const next: DailyReportsData = {
      ...data,
      reports: data.reports.map((r) =>
        r.id === id
          ? {
              ...r,
              status: late ? 'late' : 'submitted',
              submittedAt: now.toISOString(),
              summary: r.summary || 'Отчёт сдан',
            }
          : r,
      ),
    }
    await api.dailyReports.save(next)
    setData(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ежедневные отчёты</h1>
        <p className="text-sm text-gray-500 mt-1">{data.timezoneNote}</p>
      </div>

      <div className="card p-4 bg-primary-50 border-primary-100">
        <div className="text-sm text-primary-900">
          Дедлайн сдачи: <span className="font-bold">{data.deadlineLocal}</span>. После — статус «late».
        </div>
        <p className="text-xs text-primary-700 mt-1">
          Stub UI: полноценный редактор фото/видео — в следующих итерациях (пути в media/).
        </p>
      </div>

      <div className="space-y-3">
        {reports.map((r) => (
          <div
            key={r.id}
            className="card p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-gray-900 break-words">{objectTitle(r.objectId)}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {r.date} · автор {r.authorId}
                {r.clientVisible ? ' · видно клиенту' : ''}
              </div>
              <p className="text-sm text-gray-700 mt-2 break-words">
                {r.summary || 'Черновик без текста'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <span
                className={
                  r.status === 'submitted'
                    ? 'badge-green self-start'
                    : r.status === 'late'
                      ? 'badge-red self-start'
                      : 'badge-yellow self-start'
                }
              >
                {r.status}
              </span>
              {writable && r.status === 'draft' && (
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => void submitDraft(r.id)}
                >
                  Сдать до {data.deadlineLocal}
                </button>
              )}
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="card p-8 text-center text-gray-500">Нет отчётов для отображения</div>
        )}
      </div>
    </div>
  )
}
