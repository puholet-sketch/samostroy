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

/** Абстрактный адаптер хранилища. JsonRepository — фаза 1; позже Postgres/MariaDB/Supabase. */
export interface IRepository {
  getUsers(): Promise<User[]>
  getPermissions(): Promise<PermissionsData>
  savePermissions(data: PermissionsData): Promise<void>
  getObjects(): Promise<RenovationObject[]>
  getObject(id: string): Promise<RenovationObject | null>
  saveObject(obj: RenovationObject): Promise<void>
  getStageTemplate(): Promise<StageTemplate>
  getTasks(): Promise<Task[]>
  saveTask(task: Task): Promise<void>
  getChecklists(): Promise<ChecklistsData>
  saveChecklists(data: ChecklistsData): Promise<void>
  getDailyReports(): Promise<DailyReportsData>
  saveDailyReports(data: DailyReportsData): Promise<void>
  getFunnelEvents(): Promise<FunnelEvent[]>
}
