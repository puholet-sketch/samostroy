import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  DEFAULT_FEEDBACK_EMAIL_TO,
  loadFeedbackApiConfig,
  loadFeedbackEmailConfig,
  saveFeedbackApiConfig,
  saveFeedbackEmailConfig,
} from '../../lib/feedbackConfig'
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
    id: 'developer',
    label: 'Разработчик',
    defaultModules: ['feedback', 'updates', 'object_control'],
  },
  {
    id: 'foreman',
    label: 'Прораб',
    defaultModules: ['object_control', 'updates'],
  },
]

const SECURITY_ROLES = new Set<Role>(ROLE_OPTS.map((r) => r.id))

function normalizeSecurityRole(role: Role): Role {
  if (SECURITY_ROLES.has(role)) return role
  return 'foreman'
}

function roleLabel(role: Role): string {
  return ROLE_OPTS.find((r) => r.id === role)?.label ?? role
}

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
    const role = normalizeSecurityRole(u.role)
    setEditingId(u.id)
    setForm({
      id: u.id,
      login: u.login,
      password: u.password,
      name: u.name,
      role,
      active: u.active,
      allowedModules: u.allowedModules?.length
        ? [...u.allowedModules]
        : [...(ROLE_OPTS.find((r) => r.id === role)?.defaultModules ?? ['object_control'])],
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
      const role = normalizeSecurityRole(form.role)
      const mods = [...(form.allowedModules ?? [])]
      if (role === 'owner' && !mods.includes('security')) mods.push('security')
      if (role !== 'owner') {
        const i = mods.indexOf('security')
        if (i >= 0) mods.splice(i, 1)
      }
      const row: User = {
        id: editingId || `u-${Date.now()}`,
        login: form.login.trim(),
        password: form.password,
        name: form.name.trim(),
        role,
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
        Роли: владелец (полный контур), разработчик (замечания / обновления, без PII клиентов),
        прораб (контроль объекта). Модуль «Замечания» включает FAB и инбокс Ревизора.
      </p>

      <FeedbackApiSettings />
      <FeedbackEmailSettings />

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
                value={normalizeSecurityRole(form.role)}
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
                    {roleLabel(normalizeSecurityRole(u.role))}
                    {!u.active ? ' · отключена' : ''}
                    {' · '}
                    {(u.allowedModules ?? [])
                      .map((m) => MVP_MODULE_LABEL[m as keyof typeof MVP_MODULE_LABEL] || m)
                      .join(', ') || 'по роли'}
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

function FeedbackApiSettings() {
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    const cfg = loadFeedbackApiConfig()
    setBaseUrl(cfg.baseUrl)
    setToken(cfg.token)
  }, [])

  function onSave(e: FormEvent) {
    e.preventDefault()
    saveFeedbackApiConfig({ baseUrl: baseUrl.trim(), token: token.trim() })
    setSaved('Сохранено в этом браузере')
  }

  const inputCls =
    'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <Panel title="Feedback API (Docker / Termux)">
      <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-xs text-gray-500">
            Base URL (localhost при Docker на ПК, cloudflared / ngrok с телефона)
          </span>
          <input
            className={inputCls}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:8787"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-xs text-gray-500">X-Feedback-Token</span>
          <input
            className={inputCls}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="секрет из bots/feedback-bot/.env"
            autoComplete="off"
          />
        </label>
        <div className="flex items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Сохранить API
          </button>
          {saved && <span className="text-xs text-emerald-700">{saved}</span>}
        </div>
        <p className="text-[11px] text-gray-400 sm:col-span-2">
          См. docs/modules/feedback.md и bots/feedback-bot/README.md. Без API замечания
          остаются локально в браузере заказчика — для GitHub Pages настройте email ниже.
        </p>
      </form>
    </Panel>
  )
}

function FeedbackEmailSettings() {
  const [accessKey, setAccessKey] = useState('')
  const [emailTo, setEmailTo] = useState(DEFAULT_FEEDBACK_EMAIL_TO)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    const cfg = loadFeedbackEmailConfig()
    setAccessKey(cfg.accessKey)
    setEmailTo(cfg.emailTo)
  }, [])

  function onSave(e: FormEvent) {
    e.preventDefault()
    saveFeedbackEmailConfig({
      accessKey: accessKey.trim(),
      emailTo: emailTo.trim() || DEFAULT_FEEDBACK_EMAIL_TO,
    })
    setSaved('Сохранено в этом браузере')
  }

  const inputCls =
    'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <Panel title="Feedback email (Web3Forms → GitHub Pages)">
      <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-xs text-gray-500">
            Метка ящика команды (в письме; доставка = email Access Key, не это поле)
          </span>
          <input
            className={inputCls}
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder={DEFAULT_FEEDBACK_EMAIL_TO}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-xs text-gray-500">
            Web3Forms Access Key (создайте ключ, подтвердив нужный ящик — на него и придут письма)
          </span>
          <input
            className={inputCls}
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            autoComplete="off"
          />
        </label>
        <div className="flex items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Сохранить email
          </button>
          {saved && <span className="text-xs text-emerald-700">{saved}</span>}
        </div>
        <p className="text-[11px] text-gray-400 sm:col-span-2">
          Без ключа на Pages замечания не доходят до разработчика. Шаги:{' '}
          docs/modules/feedback.md · .env.example (`VITE_WEB3FORMS_ACCESS_KEY`,
          `VITE_FEEDBACK_EMAIL_TO`).
        </p>
      </form>
    </Panel>
  )
}
