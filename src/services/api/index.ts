import { repository } from '../repository/JsonRepository'
import type {
  ChecklistsData,
  DailyReportsData,
  ModuleKey,
  PermissionsData,
  RenovationObject,
  Role,
  Task,
  User,
} from '../types'

export const api = {
  users: {
    list: () => repository.getUsers(),
    findByLogin: async (login: string) => {
      const users = await repository.getUsers()
      return users.find((u) => u.login === login && u.active) ?? null
    },
  },
  permissions: {
    get: () => repository.getPermissions(),
    save: (data: PermissionsData) => repository.savePermissions(data),
    can: async (role: Role, module: ModuleKey, action: 'read' | 'write') => {
      const perms = await repository.getPermissions()
      return Boolean(perms.matrix[role]?.[module]?.[action])
    },
  },
  objects: {
    list: () => repository.getObjects(),
    get: (id: string) => repository.getObject(id),
    save: (obj: RenovationObject) => repository.saveObject(obj),
    forUser: async (user: User) => {
      const all = await repository.getObjects()
      if (user.role === 'owner') return all
      if (user.role === 'client') {
        const ids = new Set(user.linkedObjectIds ?? [])
        return all.filter((o) => ids.has(o.id) || o.clientUserId === user.id)
      }
      if (user.role === 'seller') {
        return all.filter((o) => o.sellerId === user.id)
      }
      return all
    },
  },
  stages: {
    template: () => repository.getStageTemplate(),
  },
  tasks: {
    list: () => repository.getTasks(),
    save: (task: Task) => repository.saveTask(task),
  },
  checklists: {
    get: () => repository.getChecklists(),
    save: (data: ChecklistsData) => repository.saveChecklists(data),
  },
  dailyReports: {
    get: () => repository.getDailyReports(),
    save: (data: DailyReportsData) => repository.saveDailyReports(data),
  },
  funnel: {
    list: () => repository.getFunnelEvents(),
  },
}

export function resetLocalData(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('samostroy:v1:')) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}
