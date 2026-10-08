import { Link, NavLink, Outlet } from 'react-router-dom'
import {
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
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import type { ModuleKey } from '../../services/types'

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
  const items = NAV.filter((n) => {
    if (n.module === 'reports_ops') {
      return can('reports_ops') || can('reports_sales')
    }
    return can(n.module)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            <div className="flex items-center min-w-0">
              <Link to="/" className="text-xl font-bold text-primary-600 hover:text-primary-700 shrink-0">
                Самострой
              </Link>
              <nav className="ml-6 hidden lg:flex space-x-1 overflow-x-auto">
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
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                <div className="text-xs text-gray-500">{user ? ROLE_LABEL[user.role] ?? user.role : ''}</div>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {(user?.name ?? '?').slice(0, 1)}
                </span>
              </div>
              <button type="button" className="btn-secondary px-2 py-2" onClick={logout} title="Выйти">
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <nav className="lg:hidden flex gap-1 overflow-x-auto pb-3 -mt-1">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                      isActive ? 'text-primary-600 bg-primary-50' : 'text-gray-500 bg-gray-50'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="max-w-7xl mx-auto px-4 pb-8 text-xs text-gray-400 flex items-center gap-1">
        <CheckBadgeIcon className="h-4 w-4" />
        Самострой MVP · demo data · media paths only
      </footer>
    </div>
  )
}
