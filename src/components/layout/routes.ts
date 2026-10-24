import type { ModuleKey, User } from '../../services/types'
import { loadClients } from '../../lib/clients'
import { getReleaseById } from '../../lib/changelog'

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
  { path: '/feedback', name: 'Замечания', module: 'feedback' },
  { path: '/updates', name: 'Обновления', module: 'updates' },
  { path: '/security', name: 'Безопасность', module: 'security' },
]

const CLIENT_CARD_RE = /^\/clients\/([^/]+)(?:\/([^/]+))?$/

export function parseClientCardPath(pathname: string): { id: string; section: string } | null {
  const m = pathname.match(CLIENT_CARD_RE)
  if (!m) return null
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
  const releaseMatch = pathname.match(/^\/updates\/([^/]+)\/?$/)
  if (releaseMatch) {
    const rel = getReleaseById(releaseMatch[1])
    return rel?.title ?? 'Обновления'
  }
  const hit = MVP_ROUTES.find(
    (r) => pathname === r.path || (r.path !== '/' && pathname.startsWith(`${r.path}/`)),
  )
  return hit?.name ?? 'СамоСтрой'
}

/** Стартовый раздел после входа */
export function homePathForUser(user: User): string {
  if (user.role === 'foreman') return '/control'
  if (user.role === 'developer') return '/feedback'
  const mods = user.allowedModules
  if (mods && mods.length === 1) {
    const hit = MVP_ROUTES.find((r) => r.module === mods[0])
    if (hit) return hit.path
  }
  if (mods && !mods.includes('clients')) {
    const hit = MVP_ROUTES.find((r) => mods.includes(r.module))
    if (hit) return hit.path
  }
  return '/clients'
}
