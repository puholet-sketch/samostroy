import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  RiArrowLeftLine,
  RiBuilding2Line,
  RiCalculatorLine,
  RiCloseLine,
  RiFileTextLine,
  RiIdCardLine,
  RiMenuLine,
  RiBankCardLine,
  RiFolderLine,
  RiShieldKeyholeLine,
  RiUserLine,
  RiLogoutBoxRLine,
} from '@remixicon/react'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeaderProvider, usePageHeaderSlot } from '../../contexts/PageHeaderContext'
import type { ModuleKey } from '../../services/types'
import { loadClients } from '../../lib/clients'
import { BrandLogo } from '../common/BrandLogo'
import { CLIENT_SECTIONS } from '../clients/ClientCardPage'
import { MVP_ROUTES, parseClientCardPath, routeTitle } from './routes'

const ICONS = {
  clients: RiUserLine,
  calculator: RiCalculatorLine,
  documents: RiFileTextLine,
  object_control: RiBuilding2Line,
  security: RiShieldKeyholeLine,
} as const

const SECTION_ICONS = {
  main: RiUserLine,
  passport: RiIdCardLine,
  legal: RiBankCardLine,
  docs: RiFolderLine,
} as const

const ROLE_LABEL: Record<string, string> = {
  owner: 'Директор',
  seller: 'Продавец',
  foreman: 'Прораб',
  builder: 'Строитель',
  supervisor: 'Надзор',
  client: 'Клиент',
}

const linkCls = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  ].join(' ')

function GlobalNav({
  items,
  onNavigate,
}: {
  items: typeof MVP_ROUTES
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((r) => {
        const Icon = ICONS[r.module as keyof typeof ICONS] ?? RiFileTextLine
        return (
          <NavLink
            key={r.path}
            to={r.path}
            end={r.path === '/clients'}
            onClick={onNavigate}
            className={linkCls}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {r.name}
          </NavLink>
        )
      })}
    </nav>
  )
}

function ClientContextNav({
  clientId,
  clientName,
  onNavigate,
}: {
  clientId: string
  clientName: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      <NavLink to="/clients" end onClick={onNavigate} className={linkCls}>
        <RiArrowLeftLine className="h-4 w-4 shrink-0" aria-hidden />
        К реестру
      </NavLink>
      <p className="mb-1 mt-4 truncate px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {clientName || 'Клиент'}
      </p>
      {CLIENT_SECTIONS.map((s) => {
        const Icon = SECTION_ICONS[s.id]
        return (
          <NavLink
            key={s.id}
            to={`/clients/${clientId}/${s.id}`}
            onClick={onNavigate}
            className={linkCls}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {s.label}
          </NavLink>
        )
      })}
      <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Модули
      </p>
      <NavLink to="/documents" onClick={onNavigate} className={linkCls}>
        <RiFileTextLine className="h-4 w-4 shrink-0" aria-hidden />
        Договоры и акты
      </NavLink>
      <NavLink to="/calculator" onClick={onNavigate} className={linkCls}>
        <RiCalculatorLine className="h-4 w-4 shrink-0" aria-hidden />
        Калькулятор
      </NavLink>
    </nav>
  )
}

const HEADER_H = 'h-14'

function AppShellInner() {
  const { user, logout, can } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [clientName, setClientName] = useState('')
  const headerActions = usePageHeaderSlot()

  const card = parseClientCardPath(location.pathname)

  const routes = useMemo(
    () =>
      MVP_ROUTES.filter((r) => {
        if (r.module === 'security') return can('security' as ModuleKey)
        return can(r.module)
      }),
    [can],
  )

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!card) {
      setClientName('')
      return
    }
    const c = loadClients().find((x) => x.id === card.id)
    setClientName(c?.name ?? '')
  }, [card?.id, location.pathname])

  const title = routeTitle(location.pathname)
  const sectionLabel = card
    ? CLIENT_SECTIONS.find((s) => s.id === card.section)?.label
    : null

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex ${HEADER_H} shrink-0 items-center border-b border-gray-200 px-5`}>
        <BrandLogo to="/clients" size="md" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {card ? (
          <>
            <p className="mb-2 px-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Карточка клиента
            </p>
            <ClientContextNav
              clientId={card.id}
              clientName={clientName}
              onNavigate={() => setMobileOpen(false)}
            />
          </>
        ) : (
          <>
            <p className="mb-2 px-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Меню
            </p>
            <GlobalNav items={routes} onNavigate={() => setMobileOpen(false)} />
          </>
        )}
      </div>
      <div className="border-t border-gray-200 p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-semibold text-gray-900">{user?.name}</p>
          <p className="text-xs text-gray-500">{user ? ROLE_LABEL[user.role] ?? user.role : ''}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RiLogoutBoxRLine className="h-4 w-4" />
          Выйти
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40"
            aria-label="Закрыть меню"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Одна линия border-b на уровне сайдбара (h-14) */}
        <header className={`sticky top-0 z-20 flex ${HEADER_H} items-center border-b border-gray-200 bg-white`}>
          <div className="flex w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-600 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Открыть меню"
            >
              {mobileOpen ? <RiCloseLine className="h-5 w-5" /> : <RiMenuLine className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold leading-none text-gray-900">{title}</h1>
              {sectionLabel && (
                <p className="mt-0.5 truncate text-xs text-gray-400">{sectionLabel}</p>
              )}
            </div>
            {headerActions && <div className="shrink-0">{headerActions}</div>}
          </div>
        </header>

        <main className="px-4 py-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <PageHeaderProvider>
      <AppShellInner />
    </PageHeaderProvider>
  )
}
