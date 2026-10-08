import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../services/api'
import type { ModuleKey, Role, SessionPayload, User } from '../services/types'

const SESSION_KEY = 'samostroy:session'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (login: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => void
  can: (module: ModuleKey, action?: 'read' | 'write') => boolean
  permissionsReady: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function encodeSession(payload: SessionPayload): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
}

function decodeSession(token: string): SessionPayload | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(token)))) as SessionPayload
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [permMatrix, setPermMatrix] = useState<Record<Role, Record<ModuleKey, { read: boolean; write: boolean }>> | null>(null)

  const hydrate = useCallback(async () => {
    const token = localStorage.getItem(SESSION_KEY)
    const perms = await api.permissions.get()
    setPermMatrix(perms.matrix)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    const payload = decodeSession(token)
    if (!payload || payload.exp < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      setUser(null)
      setLoading(false)
      return
    }
    const users = await api.users.list()
    const found = users.find((u) => u.id === payload.userId && u.active) ?? null
    setUser(found)
    setLoading(false)
  }, [])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const login = useCallback(async (loginName: string, password: string) => {
    const found = await api.users.findByLogin(loginName.trim())
    if (!found || found.password !== password) {
      return { ok: false as const, error: 'Неверный логин или пароль' }
    }
    const payload: SessionPayload = {
      userId: found.id,
      role: found.role,
      name: found.name,
      login: found.login,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    }
    localStorage.setItem(SESSION_KEY, encodeSession(payload))
    setUser(found)
    const perms = await api.permissions.get()
    setPermMatrix(perms.matrix)
    return { ok: true as const }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const can = useCallback(
    (module: ModuleKey, action: 'read' | 'write' = 'read') => {
      if (!user || !permMatrix) return false
      if (user.role === 'owner' && module === 'security') return true
      return Boolean(permMatrix[user.role]?.[module]?.[action])
    },
    [user, permMatrix],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      can,
      permissionsReady: Boolean(permMatrix),
    }),
    [user, loading, login, logout, can, permMatrix],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
