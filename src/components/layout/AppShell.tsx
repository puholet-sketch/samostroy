import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  RiArrowLeftLine,
  RiBuilding2Fill,
  RiCalculatorFill,
  RiCloseLine,
  RiFileTextFill,
  RiIdCardFill,
  RiMenuLine,
  RiBankCardFill,
  RiFolderFill,
  RiSettings3Fill,
  RiUserFill,
  RiLogoutBoxRLine,
  RiHistoryFill,
  RiFeedbackFill,
  type RemixiconComponentType,
} from '@remixicon/react'
import { useAuth } from '../../contexts/AuthContext'
import {
  PageHeaderProvider,
  usePageHeaderMetaSlot,
  usePageHeaderSlot,
} from '../../contexts/PageHeaderContext'
import type { ModuleKey } from '../../services/types'
import { loadClients } from '../../lib/clients'
import { BrandLogo } from '../common/BrandLogo'
import { CLIENT_SECTIONS } from '../clients/ClientCardPage'
import { FeedbackHost, useFeedbackOpenCount } from '../feedback/FeedbackHost'
import { homePathForUser, MVP_ROUTES, parseClientCardPath, routeTitle } from './routes'

type NavIcon = {
  Icon: RemixiconComponentType
  ink: string
}

const NAV_ICONS: Record<string, NavIcon> = {
  clients: { Icon: RiUserFill, ink: 'text-blue-600' },
  calculator: { Icon: RiCalculatorFill, ink: 'text-violet-600' },
  documents: { Icon: RiFileTextFill, ink: 'text-amber-600' },
  object_control: { Icon: RiBuilding2Fill, ink: 'text-emerald-600' },
  updates: { Icon: RiHistoryFill, ink: 'text-sky-600' },
  security: { Icon: RiSettings3Fill, ink: 'text-rose-600' },
  feedback: { Icon: RiFeedbackFill, ink: 'text-rose-600' },
}

const SECTION_ICONS: Record<string, NavIcon> = {
  main: { Icon: RiUserFill, ink: 'text-blue-600' },
  passport: { Icon: RiIdCardFill, ink: 'text-indigo-600' },
  legal: { Icon: RiBankCardFill, ink: 'text-amber-600' },
  docs: { Icon: RiFolderFill, ink: 'text-teal-600' },
}

function ColoredIcon({ ink, Icon }: NavIcon) {
  return <Icon className={`h-4 w-4 shrink-0 ${ink}`} aria-hidden />
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Владелец',
  developer: 'Разработчик',
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
  feedbackBadge,
}: {
  items: typeof MVP_ROUTES
  onNavigate?: () => void
  feedbackBadge?: number
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((r) => {
        const conf = NAV_ICONS[r.module] ?? NAV_ICONS.documents
        const badge = r.module === 'feedback' && feedbackBadge && feedbackBadge > 0 ? feedbackBadge : 0
        return (
          <NavLink
            key={r.path}
            to={r.path}
            end={r.path === '/clients'}
            onClick={onNavigate}
            className={linkCls}
          >
            <ColoredIcon {...conf} />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            {badge > 0 && (
              <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
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
        <RiArrowLeftLine className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        К реестру
      </NavLink>
      <p className="mb-1 mt-4 truncate px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {clientName || 'Клиент'}
      </p>
      {CLIENT_SECTIONS.map((s) => {
        const conf = SECTION_ICONS[s.id]
        return (
          <NavLink
            key={s.id}
            to={`/clients/${clientId}/${s.id}`}
            onClick={onNavigate}
            className={linkCls}
          >
            <ColoredIcon {...conf} />
            {s.label}
          </NavLink>
        )
      })}
      <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Модули
      </p>
      <NavLink to="/documents" onClick={onNavigate} className={linkCls}>
        <ColoredIcon {...NAV_ICONS.documents} />
        Договоры и акты
      </NavLink>
      <NavLink to="/calculator" onClick={onNavigate} className={linkCls}>
        <ColoredIcon {...NAV_ICONS.calculator} />
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
  const [captureOpen, setCaptureOpen] = useState(false)
  const headerActions = usePageHeaderSlot()
  const headerMeta = usePageHeaderMetaSlot()
  const canFeedback = can('feedback')
  const feedbackBadge = useFeedbackOpenCount(canFeedback)

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

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex ${HEADER_H} shrink-0 items-center border-b border-gray-200 px-5`}>
        <BrandLogo to={user ? homePathForUser(user) : '/'} size="md" />
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
            <GlobalNav
              items={routes}
              onNavigate={() => setMobileOpen(false)}
              feedbackBadge={feedbackBadge}
            />
          </>
        )}
      </div>
      <div className="border-t border-gray-200 p-4">
        {canFeedback && (
          <button
            type="button"
            data-feedback-ui
            onClick={() => {
              setCaptureOpen(true)
              setMobileOpen(false)
            }}
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            <RiFeedbackFill className="h-4 w-4" />
            Замечание
          </button>
        )}
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h1 className="truncate text-lg font-semibold leading-none text-gray-900">{title}</h1>
              {headerMeta && <div className="min-w-0 shrink truncate">{headerMeta}</div>}
            </div>
            {headerActions && <div className="shrink-0">{headerActions}</div>}
          </div>
        </header>

        <main className="px-4 py-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      {canFeedback && (
        <FeedbackHost open={captureOpen} onOpenChange={setCaptureOpen} />
      )}
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
