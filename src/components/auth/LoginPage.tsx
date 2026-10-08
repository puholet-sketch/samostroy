import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const [loginName, setLoginName] = useState('owner')
  const [password, setPassword] = useState('owner123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login(loginName, password)
    if (!res.ok) setError(res.error)
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-100 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-600">Самострой</h1>
          <p className="mt-1 text-sm text-gray-500">CRM и операционка ремонтной компании</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login">Логин</label>
            <input
              id="login"
              className="input"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>
        <p className="mt-6 text-xs text-gray-400">
          Демо: owner / owner123 · seller / seller123 · client / client123
        </p>
      </div>
    </div>
  )
}
