import usersSeed from '@data/users.json'
import permissionsSeed from '@data/permissions.json'
import objectsSeed from '@data/objects.json'
import stageTemplateSeed from '@data/stage_template.json'
import tasksSeed from '@data/tasks.json'
import checklistsSeed from '@data/checklists.json'
import dailyReportsSeed from '@data/daily_reports.json'
import funnelSeed from '@data/funnel_events.json'
import type { IRepository } from './IRepository'
import type {
  AppNotification,
  ChecklistsData,
  DailyReportsData,
  FunnelEvent,
  PermissionsData,
  RenovationObject,
  Role,
  StageTemplate,
  Task,
  User,
} from '../types'
import { normalizeIssue } from '../../lib/issues'

const PREFIX = 'samostroy:v1:'

function load<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* ignore corrupt */
  }
  return structuredClone(seed)
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export class JsonRepository implements IRepository {
  async getUsers(): Promise<User[]> {
    return load('users', usersSeed as User[])
  }

  async getPermissions(): Promise<PermissionsData> {
    const seed = permissionsSeed as PermissionsData
    const stored = load('permissions', seed)
    const modules = [...new Set([...seed.modules, ...stored.modules])] as PermissionsData['modules']
    const matrix = { ...stored.matrix } as PermissionsData['matrix']
    for (const role of Object.keys(seed.matrix) as Role[]) {
      const seedRow = seed.matrix[role]
      const row = { ...(matrix[role] ?? {}) } as PermissionsData['matrix'][Role]
      for (const mod of seed.modules) {
        if (!row[mod]) row[mod] = { ...seedRow[mod] }
      }
      matrix[role] = row
    }
    return { modules, matrix }
  }

  async savePermissions(data: PermissionsData): Promise<void> {
    save('permissions', data)
  }

  async getObjects(): Promise<RenovationObject[]> {
    // v2 key picks up enriched stage payments without wiping tasks/permissions
    return load('objects_v2', objectsSeed as RenovationObject[])
  }

  async getObject(id: string): Promise<RenovationObject | null> {
    const all = await this.getObjects()
    return all.find((o) => o.id === id) ?? null
  }

  async saveObject(obj: RenovationObject): Promise<void> {
    const all = await this.getObjects()
    const idx = all.findIndex((o) => o.id === obj.id)
    if (idx >= 0) all[idx] = obj
    else all.push(obj)
    save('objects_v2', all)
  }

  async getStageTemplate(): Promise<StageTemplate> {
    return load('stage_template', stageTemplateSeed as StageTemplate)
  }

  async getTasks(): Promise<Task[]> {
    // v3: issueType / parentId / stageNumber hierarchy
    const raw = load('tasks_v3', tasksSeed as Task[])
    return raw.map((t) => normalizeIssue(t))
  }

  async getTask(id: string): Promise<Task | null> {
    const all = await this.getTasks()
    return all.find((t) => t.id === id) ?? null
  }

  async saveTask(task: Task): Promise<void> {
    const all = await this.getTasks()
    const normalized = normalizeIssue(task)
    const idx = all.findIndex((t) => t.id === normalized.id)
    if (idx >= 0) all[idx] = normalized
    else all.push(normalized)
    save('tasks_v3', all)
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    save(
      'tasks_v3',
      tasks.map((t) => normalizeIssue(t)),
    )
  }

  async deleteTask(id: string): Promise<void> {
    const all = await this.getTasks()
    const remove = new Set<string>()
    const walk = (pid: string) => {
      remove.add(pid)
      for (const child of all.filter((t) => t.parentId === pid)) walk(child.id)
    }
    walk(id)
    save(
      'tasks_v3',
      all.filter((t) => !remove.has(t.id)).map((t) => normalizeIssue(t)),
    )
  }

  async getNotifications(): Promise<AppNotification[]> {
    return load('notifications', [] as AppNotification[])
  }

  async saveNotifications(items: AppNotification[]): Promise<void> {
    save('notifications', items)
  }

  async getChecklists(): Promise<ChecklistsData> {
    return load('checklists', checklistsSeed as ChecklistsData)
  }

  async saveChecklists(data: ChecklistsData): Promise<void> {
    save('checklists', data)
  }

  async getDailyReports(): Promise<DailyReportsData> {
    return load('daily_reports', dailyReportsSeed as DailyReportsData)
  }

  async saveDailyReports(data: DailyReportsData): Promise<void> {
    save('daily_reports', data)
  }

  async getFunnelEvents(): Promise<FunnelEvent[]> {
    return load('funnel_events', funnelSeed as FunnelEvent[])
  }
}

export const repository: IRepository = new JsonRepository()
