import type {
  AppNotification,
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
  getTask(id: string): Promise<Task | null>
  saveTask(task: Task): Promise<void>
  saveTasks(tasks: Task[]): Promise<void>
  /** Deletes issue and all descendants. */
  deleteTask(id: string): Promise<void>
  getNotifications(): Promise<AppNotification[]>
  saveNotifications(items: AppNotification[]): Promise<void>
  getChecklists(): Promise<ChecklistsData>
  saveChecklists(data: ChecklistsData): Promise<void>
  getDailyReports(): Promise<DailyReportsData>
  saveDailyReports(data: DailyReportsData): Promise<void>
  getFunnelEvents(): Promise<FunnelEvent[]>
}
