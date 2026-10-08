import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon } from '@heroicons/react/24/outline'
import { useNotifications } from '../../contexts/NotificationsContext'
import { formatDateTimeRu } from '../../lib/userDisplay'

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function openPanel() {
    const next = !open
    setOpen(next)
    if (next) await refresh()
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative inline-flex items-center justify-center min-h-11 min-w-11 p-2 rounded-md text-gray-500 hover:text-primary-600 hover:bg-gray-50"
        onClick={() => void openPanel()}
        title="Уведомления"
        aria-label="Уведомления"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-accent-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-800">Уведомления</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary-600 hover:underline"
                onClick={() => void markAllRead()}
              >
                Прочитать все
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {items.length === 0 && (
              <li className="px-3 py-6 text-sm text-gray-400 text-center">Пока нет уведомлений</li>
            )}
            {items.slice(0, 20).map((n) => (
              <li key={n.id}>
                <Link
                  to={`/tasks/${n.taskId}`}
                  className={`block px-3 py-2.5 hover:bg-primary-50 transition-colors ${
                    n.read ? 'bg-white' : 'bg-accent-50/60'
                  }`}
                  onClick={() => {
                    void markRead(n.id)
                    setOpen(false)
                  }}
                >
                  <div className="text-sm font-medium text-gray-900">{n.title}</div>
                  <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</div>
                  <div className="text-[11px] text-gray-400 mt-1">{formatDateTimeRu(n.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
