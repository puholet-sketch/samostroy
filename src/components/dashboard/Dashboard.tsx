import { Link } from 'react-router-dom'
import {
  BuildingOffice2Icon,
  ClockIcon,
  MapIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { useObjects } from '../../hooks/useObjects'
import { useEffect, useState } from 'react'
import { api } from '../../services/api'

export default function Dashboard() {
  const { user, can } = useAuth()
  const { objects, loading } = useObjects()
  const [taskCount, setTaskCount] = useState(0)
  const [lateHint, setLateHint] = useState('')

  useEffect(() => {
    void (async () => {
      const tasks = await api.tasks.list()
      setTaskCount(
        tasks.filter((t) => t.issueType === 'task' && t.status !== 'done').length,
      )
      const dr = await api.dailyReports.get()
      setLateHint(`Дедлайн ежедневного отчёта: ${dr.deadlineLocal}`)
    })()
  }, [])

  const inProgress = objects.filter((o) => o.status === 'in_progress').length
  const leads = objects.filter((o) => o.status === 'lead' || o.status === 'design').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.role === 'owner'
            ? 'Обзор компании: объекты, задачи, отчёты'
            : `Добро пожаловать, ${user?.name}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Объекты"
          value={loading ? '…' : String(objects.length)}
          subtitle={`${inProgress} в работе · ${leads} лиды/дизайн`}
          icon={BuildingOffice2Icon}
          to={can('objects') ? '/objects' : undefined}
        />
        <StatCard
          title="Открытые задачи"
          value={String(taskCount)}
          subtitle="todo / in progress / waiting"
          icon={QueueListIcon}
          to={can('tasks') ? '/tasks' : undefined}
        />
        <StatCard
          title="Карта"
          value="МСК + МО"
          subtitle="маркеры объектов"
          icon={MapIcon}
          to={can('map') ? '/map' : undefined}
        />
        <StatCard
          title="Отчёт дня"
          value="21:00"
          subtitle={lateHint || 'дедлайн сдачи'}
          icon={ClockIcon}
          to={can('daily_reports') ? '/daily-reports' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Последние объекты</h2>
          <ul className="divide-y divide-gray-100">
            {objects.slice(0, 5).map((o) => (
              <li key={o.id} className="py-2.5 flex justify-between gap-3 text-sm">
                <div>
                  <Link to={`/objects/${o.id}`} className="font-medium text-primary-600 hover:underline">
                    {o.title}
                  </Link>
                  <div className="text-gray-500">{o.address}</div>
                </div>
                <span className="badge-blue shrink-0 h-fit">{o.status}</span>
              </li>
            ))}
            {!loading && objects.length === 0 && (
              <li className="py-4 text-sm text-gray-500">Нет доступных объектов</li>
            )}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Подсказки MVP</h2>
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
            <li>Матрица прав — раздел «Безопасность» (только директор).</li>
            <li>Суммы этапов редактируются на карточке объекта.</li>
            <li>Клиент видит этапы/отчёты только с флагом clientVisible.</li>
            <li>Медиа хранятся как файлы в media/, в JSON — пути.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  to,
}: {
  title: string
  value: string
  subtitle: string
  icon: typeof BuildingOffice2Icon
  to?: string
}) {
  const body = (
    <div className="card p-5 hover:border-primary-200 transition-colors h-full">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
          <div className="mt-1 text-xs text-gray-400">{subtitle}</div>
        </div>
        <div className="rounded-lg bg-primary-50 p-2">
          <Icon className="h-6 w-6 text-primary-600" />
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}
