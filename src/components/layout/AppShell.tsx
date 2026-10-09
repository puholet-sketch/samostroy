import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bars3Icon,
  BuildingOffice2Icon,
  ChartBarIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  MapIcon,
  DocumentTextIcon,
  QueueListIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import type { ModuleKey } from '../../services/types'
import { BrandLogo } from '../common/BrandLogo'
import { NotificationBell } from './NotificationBell'

const NAV: { to: string; label: string; module: ModuleKey; icon: typeof HomeIcon }[] = [
  { to: '/', label: 'Дашборд', module: 'dashboard', icon: HomeIcon },
  { to: '/objects', label: 'Объекты', module: 'objects', icon: BuildingOffice2Icon },
  { to: '/map', label: 'Карта', module: 'map', icon: MapIcon },
  { to: '/tasks', label: 'Задачи', module: 'tasks', icon: QueueListIcon },
  { to: '/daily-reports', label: 'Отчёты дня', module: 'daily_reports', icon: DocumentTextIcon },
  { to: '/checklist', label: 'Чек-лист', module: 'checklist', icon: ClipboardDocumentListIcon },
  { to: '/reports', label: 'Отчёты', module: 'reports_ops', icon: ChartBarIcon },
  { to: '/security', label: 'Безопасность', module: 'security', icon: Cog6ToothIcon },
]

const ROLE_LABEL: Record<string, string> = {
  owner: 'Директор',
  seller: 'Продавец',
  foreman: 'Прораб',
  builder: 'Строитель',
  supervisor: 'Надзор',
  client: 'Клиент',
}

export function AppShell() {
  const { user, logout, can } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const items = NAV.filter((n) => {
    if (n.module === 'reports_ops') {
      return can('reports_ops') || can('reports_sales') || can('reports_finance')
    }
    return can(n.module)
  })

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-2 sm:gap-4">
            <div className="flex items-center min-w-0 gap-2">
              <button
                type="button"
                className="lg:hidden inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label={drawerOpen ? 'Закрыть меню' : 'Открыть меню'}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((v) => !v)}
              >
                {drawerOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
              <BrandLogo size="md" />
              <nav className="ml-4 hidden lg:flex space-x-1">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'text-primary-600 bg-primary-50'
                          : 'text-gray-500 hover:text-primary-600 hover:bg-gray-50'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
              <NotificationBell />
              <div className="text-right hidden sm:block min-w-0 max-w-[10rem] md:max-w-[14rem]">
                <div className="text-sm font-medium text-gray-900 truncate">{user?.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {user ? ROLE_LABEL[user.role] ?? user.role : ''}
                </div>
              </div>
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {(user?.name ?? '?').slice(0, 1)}
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary min-h-11 min-w-11 px-2 py-2"
                onClick={logout}
                title="Выйти"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-gray-900/40 transition-opacity ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Закрыть меню"
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-white shadow-xl transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 h-14">
            <BrandLogo size="sm" />
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-gray-600 hover:bg-gray-100"
              aria-label="Закрыть меню"
              onClick={() => setDrawerOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="px-4 py-3 border-b border-gray-100 sm:hidden">
            <div className="text-sm font-medium text-gray-900 truncate">{user?.name}</div>
            <div className="text-xs text-gray-500">
              {user ? ROLE_LABEL[user.role] ?? user.role : ''}
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-md text-sm font-medium ${
                      isActive
                        ? 'text-primary-600 bg-primary-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </aside>
      </div>

      <main className="max-w-7xl mx-auto w-full py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="max-w-7xl mx-auto px-3 sm:px-4 pb-8 text-xs text-gray-400 flex items-center gap-1.5">
        <CheckBadgeIcon className="h-4 w-4 shrink-0" />
        <span>
          <span className="text-primary-500 font-semibold">Само</span>
          <span className="text-emerald-600 font-semibold">Строй</span>
          {' '}MVP · demo data · media paths only
        </span>
      </footer>
    </div>
  )
}
