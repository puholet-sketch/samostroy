import type { ModuleKey } from '../../services/types'
import { loadClients } from '../../lib/clients'

export type NavRoute = {
  path: string
  name: string
  module: ModuleKey
}

export const MVP_ROUTES: NavRoute[] = [
  { path: '/clients', name: 'Клиенты', module: 'clients' },
  { path: '/calculator', name: 'Калькулятор', module: 'calculator' },
  { path: '/documents', name: 'Договоры и акты', module: 'documents' },
  { path: '/control', name: 'Контроль объекта', module: 'object_control' },
  { path: '/security', name: 'Безопасность', module: 'security' },
]

const CLIENT_CARD_RE = /^\/clients\/([^/]+)(?:\/([^/]+))?$/

export function parseClientCardPath(pathname: string): { id: string; section: string } | null {
  const m = pathname.match(CLIENT_CARD_RE)
  if (!m) return null
  // exclude bare /clients
  if (pathname === '/clients') return null
  return { id: m[1], section: m[2] || 'main' }
}

export function routeTitle(pathname: string): string {
  const card = parseClientCardPath(pathname)
  if (card) {
    const clients = loadClients()
    const c = clients.find((x) => x.id === card.id)
    if (c?.name) return c.name
    return 'Карточка клиента'
  }
  const hit = MVP_ROUTES.find(
    (r) => pathname === r.path || (r.path !== '/' && pathname.startsWith(`${r.path}/`)),
  )
  return hit?.name ?? 'СамоСтрой'
}
