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
import type { AppNotification } from '../services/types'
import { useAuth } from './AuthContext'

type NotificationsContextValue = {
  items: AppNotification[]
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const list = await api.notifications.forUser(user.id)
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Periodic light poll so assign from another tab/session shows up
  useEffect(() => {
    if (!user) return
    const id = window.setInterval(() => void refresh(), 8000)
    return () => window.clearInterval(id)
  }, [user, refresh])

  const markRead = useCallback(
    async (id: string) => {
      await api.notifications.markRead(id)
      await refresh()
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    if (!user) return
    await api.notifications.markAllRead(user.id)
    await refresh()
  }, [user, refresh])

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications outside NotificationsProvider')
  return ctx
}
