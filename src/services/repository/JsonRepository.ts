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
  ChecklistsData,
  DailyReportsData,
  FunnelEvent,
  PermissionsData,
  RenovationObject,
  StageTemplate,
  Task,
  User,
} from '../types'

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
    return load('permissions', permissionsSeed as PermissionsData)
  }

  async savePermissions(data: PermissionsData): Promise<void> {
    save('permissions', data)
  }

  async getObjects(): Promise<RenovationObject[]> {
    return load('objects', objectsSeed as RenovationObject[])
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
    save('objects', all)
  }

  async getStageTemplate(): Promise<StageTemplate> {
    return load('stage_template', stageTemplateSeed as StageTemplate)
  }

  async getTasks(): Promise<Task[]> {
    return load('tasks', tasksSeed as Task[])
  }

  async saveTask(task: Task): Promise<void> {
    const all = await this.getTasks()
    const idx = all.findIndex((t) => t.id === task.id)
    if (idx >= 0) all[idx] = task
    else all.push(task)
    save('tasks', all)
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
