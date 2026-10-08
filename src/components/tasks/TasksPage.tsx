import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { Task, TaskStatus } from '../../services/types'
import { useObjects } from '../../hooks/useObjects'

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'К выполнению' },
  { status: 'in_progress', title: 'В работе' },
  { status: 'waiting_client', title: 'Ждём клиента' },
  { status: 'paused', title: 'Пауза' },
  { status: 'done', title: 'Готово' },
]

export default function TasksPage() {
  const { can } = useAuth()
  const { objects } = useObjects()
  const [tasks, setTasks] = useState<Task[]>([])
  const writable = can('tasks', 'write')

  const objectTitle = useMemo(() => {
    const m = new Map(objects.map((o) => [o.id, o.title]))
    return (id: string) => m.get(id) ?? id
  }, [objects])

  async function reload() {
    setTasks(await api.tasks.list())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function move(task: Task, status: TaskStatus) {
    if (!writable) return
    const next = { ...task, status }
    await api.tasks.save(next)
    await reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
        <p className="text-sm text-gray-500 mt-1">Мини-доска: todo → done</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.status)
          return (
            <div key={col.status} className="card p-3 bg-gray-50/80">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">{col.title}</h2>
                <span className="badge-gray">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {items.map((t) => (
                  <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="text-sm font-medium text-gray-900">{t.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{objectTitle(t.objectId)}</div>
                    <div className="text-xs text-gray-400 mt-1">до {t.dueDate ?? '—'}</div>
                    {writable && (
                      <select
                        className="input mt-2 text-xs py-1"
                        value={t.status}
                        onChange={(e) => void move(t, e.target.value as TaskStatus)}
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.status} value={c.status}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
