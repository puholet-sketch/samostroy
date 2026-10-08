import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { ModuleKey, PermissionsData, Role } from '../../services/types'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Директор',
  seller: 'Продавец',
  foreman: 'Прораб',
  builder: 'Строитель',
  supervisor: 'Надзор',
  client: 'Клиент',
}

const MODULE_LABEL: Record<ModuleKey, string> = {
  dashboard: 'Дашборд',
  objects: 'Объекты',
  pipeline: 'Этапы',
  map: 'Карта',
  tasks: 'Задачи',
  daily_reports: 'Отчёты дня',
  checklist: 'Чек-лист',
  reports_ops: 'Отчёт ops',
  reports_sales: 'Воронка',
  security: 'Безопасность',
}

export default function SecurityPage() {
  const { user, can } = useAuth()
  const [data, setData] = useState<PermissionsData | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void api.permissions.get().then(setData)
  }, [])

  if (user?.role !== 'owner' && !can('security', 'write')) {
    return (
      <div className="card p-8 text-center text-gray-600">
        Матрица прав доступна только директору (owner).
      </div>
    )
  }

  if (!data) return <div className="text-gray-500">Загрузка…</div>

  const roles = Object.keys(data.matrix) as Role[]

  function toggle(role: Role, module: ModuleKey, action: 'read' | 'write') {
    if (!data) return
    if (role === 'owner' && module === 'security') return
    const next: PermissionsData = {
      ...data,
      matrix: {
        ...data.matrix,
        [role]: {
          ...data.matrix[role],
          [module]: {
            ...data.matrix[role][module],
            [action]: !data.matrix[role][module][action],
          },
        },
      },
    }
    setData(next)
  }

  async function save() {
    if (!data) return
    setSaving(true)
    await api.permissions.save(data)
    setMsg('Права сохранены (localStorage). Перезайдите для применения в других вкладках.')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Безопасность</h1>
          <p className="text-sm text-gray-500 mt-1">Матрица роль × модуль × read/write</p>
        </div>
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-primary-50 text-left">
              <th className="p-3 font-semibold text-primary-800">Модуль</th>
              {roles.map((r) => (
                <th key={r} className="p-3 font-semibold text-primary-800 whitespace-nowrap">
                  {ROLE_LABEL[r]}
                  <div className="text-[10px] font-normal text-primary-600">R / W</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.modules.map((mod) => (
              <tr key={mod} className="border-t border-gray-100">
                <td className="p-3 font-medium text-gray-900 whitespace-nowrap">
                  {MODULE_LABEL[mod]}
                  <div className="text-xs text-gray-400">{mod}</div>
                </td>
                {roles.map((role) => {
                  const flag = data.matrix[role][mod]
                  const lockOwnerSec = role === 'owner' && mod === 'security'
                  return (
                    <td key={role} className="p-3">
                      <div className="flex gap-3">
                        <label className="inline-flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={flag.read}
                            disabled={lockOwnerSec}
                            onChange={() => toggle(role, mod, 'read')}
                          />
                          R
                        </label>
                        <label className="inline-flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={flag.write}
                            disabled={lockOwnerSec}
                            onChange={() => toggle(role, mod, 'write')}
                          />
                          W
                        </label>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
