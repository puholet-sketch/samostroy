import type { Role, User } from '../services/types'

/** Роли, которым можно назначать задачи (не клиент). */
export const ASSIGNABLE_ROLES: Role[] = [
  'owner',
  'seller',
  'foreman',
  'builder',
  'supervisor',
]

export function isAssignableUser(user: User): boolean {
  return user.active && ASSIGNABLE_ROLES.includes(user.role)
}

/** Инициалы по ФИО: «Игорь Прорабов» → «ИП». */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function formatDateRu(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso
  return `${day}.${m}.${y}`
}

export function formatDateTimeRu(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
