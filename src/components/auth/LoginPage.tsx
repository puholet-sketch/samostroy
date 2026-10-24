import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { BrandLogo } from '../common/BrandLogo'
import { homePathForUser } from '../layout/routes'
import { Panel } from '../ui/Kpi'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const [loginName, setLoginName] = useState('owner')
  const [password, setPassword] = useState('owner123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Вход — СамоСтрой'
  }, [])

  if (!loading && user) return <Navigate to={homePathForUser(user)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login(loginName, password)
    if (!res.ok) setError(res.error)
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <Panel className="w-full max-w-md">
        <BrandLogo to={null} size="lg" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Вход</h1>
        <p className="text-sm text-gray-500">CRM ремонта · стиль Tremor Dashboard</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Логин</span>
            <input
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Пароль</span>
            <input
              type="password"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Вход…' : 'Войти'}
          </button>
          <p className="text-center text-xs text-gray-400">
            Демо: owner / owner123 · developer / developer123 · foreman / foreman123
          </p>
        </form>
      </Panel>
    </div>
  )
}
