import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  MVP_MODULE_LABEL,
  MVP_MODULES,
  type ModuleKey,
  type Role,
  type User,
} from '../../services/types'
import { Panel } from '../ui/Kpi'

const ROLE_OPTS: { id: Role; label: string; defaultModules: ModuleKey[] }[] = [
  {
    id: 'owner',
    label: 'Владелец',
    defaultModules: [...MVP_MODULES],
  },
  {
    id: 'foreman',
    label: 'Прораб',
    defaultModules: ['object_control', 'updates'],
  },
]

const emptyForm = (): Omit<User, 'id'> & { id?: string } => ({
  login: '',
  password: '',
  name: '',
  role: 'foreman',
  active: true,
  allowedModules: ['object_control', 'updates'],
})

export default function SecurityPage() {
  const { user: me, can } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload() {
    setUsers(await api.users.list())
  }

  useEffect(() => {
    document.title = 'Безопасность — СамоСтрой'
    void reload()
  }, [])

  if (me?.role !== 'owner' && !can('security', 'write')) {
    return (
      <Panel>
        <p className="text-sm text-gray-600">Раздел доступен только владельцу.</p>
      </Panel>
    )
  }

  function startEdit(u: User) {
    setEditingId(u.id)
    setForm({
      id: u.id,
      login: u.login,
      password: u.password,
      name: u.name,
      role: u.role === 'owner' ? 'owner' : 'foreman',
      active: u.active,
      allowedModules: u.allowedModules?.length
        ? [...u.allowedModules]
        : ROLE_OPTS.find((r) => r.id === (u.role === 'owner' ? 'owner' : 'foreman'))
            ?.defaultModules ?? ['object_control'],
    })
    setMsg('')
  }

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setMsg('')
  }

  function toggleModule(mod: ModuleKey) {
    const cur = new Set(form.allowedModules ?? [])
    if (cur.has(mod)) cur.delete(mod)
    else cur.add(mod)
    // security только у владельца
    if (form.role !== 'owner') cur.delete('security')
    setForm((f) => ({ ...f, allowedModules: [...cur] }))
  }

  function onRoleChange(role: Role) {
    const def = ROLE_OPTS.find((r) => r.id === role)?.defaultModules ?? []
    setForm((f) => ({ ...f, role, allowedModules: [...def] }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.login.trim() || !form.name.trim() || !form.password.trim()) {
      setMsg('Заполните имя, логин и пароль')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const mods = [...(form.allowedModules ?? [])]
      if (form.role === 'owner' && !mods.includes('security')) mods.push('security')
      const row: User = {
        id: editingId || `u-${Date.now()}`,
        login: form.login.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role === 'owner' ? 'owner' : 'foreman',
        active: form.active,
        allowedModules: mods,
      }
      const existsLogin = users.some(
        (u) => u.login.toLowerCase() === row.login.toLowerCase() && u.id !== row.id,
      )
      if (existsLogin) {
        setMsg('Такой логин уже занят')
        return
      }
      await api.users.upsert(row)
      await reload()
      startCreate()
      setMsg(editingId ? 'Учётная запись обновлена' : 'Учётная запись создана')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (id === me?.id) {
      setMsg('Нельзя удалить свою учётную запись')
      return
    }
    if (!confirm('Удалить учётную запись?')) return
    await api.users.remove(id)
    await reload()
    if (editingId === id) startCreate()
    setMsg('Удалено')
  }

  const inputCls =
    'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Две роли: владелец и прораб. Прораб по умолчанию видит только контроль объекта (отчёты).
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={editingId ? 'Изменить учётку' : 'Новая учётная запись'}>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-0.5 block text-xs text-gray-500">Имя</span>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-xs text-gray-500">Логин</span>
                <input
                  className={inputCls}
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-gray-500">Пароль</span>
                <input
                  className={inputCls}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-0.5 block text-xs text-gray-500">Роль</span>
              <select
                className={inputCls}
                value={form.role === 'owner' ? 'owner' : 'foreman'}
                onChange={(e) => onRoleChange(e.target.value as Role)}
              >
                {ROLE_OPTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-gray-500">
                Видимые разделы
              </legend>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {MVP_MODULES.map((mod) => {
                  const locked = form.role !== 'owner' && mod === 'security'
                  const checked = Boolean(form.allowedModules?.includes(mod))
                  return (
                    <label
                      key={mod}
                      className={`inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                        locked ? 'border-gray-100 text-gray-400' : 'border-gray-200 text-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={checked && !locked}
                        onChange={() => toggleModule(mod)}
                      />
                      {MVP_MODULE_LABEL[mod]}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Активна
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? '…' : editingId ? 'Сохранить' : 'Создать'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              )}
            </div>
            {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          </form>
        </Panel>

        <Panel title="Учётные записи">
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {u.name}{' '}
                    <span className="font-normal text-gray-400">@{u.login}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {u.role === 'owner' ? 'Владелец' : 'Прораб'}
                    {!u.active ? ' · отключена' : ''}
                    {' · '}
                    {(u.allowedModules ?? []).map((m) => MVP_MODULE_LABEL[m as keyof typeof MVP_MODULE_LABEL] || m).join(', ') ||
                      'по роли'}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => startEdit(u)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  onClick={() => void onDelete(u.id)}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
