export type Role =
  | 'owner'
  | 'seller'
  | 'foreman'
  | 'builder'
  | 'supervisor'
  | 'client'

export type ModuleKey =
  | 'dashboard'
  | 'objects'
  | 'pipeline'
  | 'map'
  | 'tasks'
  | 'daily_reports'
  | 'checklist'
  | 'reports_ops'
  | 'reports_sales'
  | 'reports_finance'
  | 'security'

export type PermissionFlag = { read: boolean; write: boolean }

export type PermissionsData = {
  modules: ModuleKey[]
  matrix: Record<Role, Record<ModuleKey, PermissionFlag>>
}

export type User = {
  id: string
  login: string
  password: string
  name: string
  role: Role
  active: boolean
  linkedObjectIds?: string[]
}

export type Contact = {
  name: string
  phone: string
  note?: string
}

export type MaterialsMode = 'turnkey' | 'customer_materials'

export type ObjectCrm = {
  hobbies: string
  preferredChannel: string
  maritalStatus: string
  age: number | null
  birthday: string | null
  childrenCount: number | null
  wishes: string
  car: string
  occupation: string
  materialsMode: MaterialsMode
  designNeeded: boolean
  desiredStartDate: string | null
  nextStep: string
  nextStepAt: string | null
}

export type StageStatus = 'planned' | 'in_progress' | 'done_pending_act' | 'closed'

export type ObjectStage = {
  n: number
  name: string
  plannedAmount: number
  status: StageStatus
  actSigned: boolean
  paid: boolean
  paidAmount: number
  paidAt: string | null
  clientVisible: boolean
}

export type ObjectStatus = 'lead' | 'design' | 'contract' | 'in_progress' | 'done'

export type RenovationObject = {
  id: string
  title: string
  address: string
  lat: number
  lng: number
  sellerId: string
  clientUserId: string | null
  status: ObjectStatus
  areaM2: number
  contacts: Contact[]
  crm: ObjectCrm
  stages: ObjectStage[]
  mediaPaths: string[]
  createdAt: string
}

export type StageTemplate = {
  id: string
  name: string
  source?: string
  note?: string
  stages: { n: number; name: string; defaultPct: number }[]
}

export type TaskStatus = 'todo' | 'in_progress' | 'waiting_client' | 'paused' | 'done'

export type TaskPriority = 'low' | 'medium' | 'high'

/** Jira-like: Epic → Story → Task (no subtasks). */
export type IssueType = 'epic' | 'story' | 'task'

export type TaskComment = {
  id: string
  authorId: string
  text: string
  createdAt: string
}

/**
 * Work item (issue). Kept as `Task` for repository compatibility.
 * Hierarchy: epic (parentId null) → story → task.
 * Stage payment acts: stories under «Ремонт» with stageNumber 1–14.
 */
export type Task = {
  id: string
  objectId: string
  issueType: IssueType
  /** null for epic; epic id for top stories; story id for stage stories / tasks */
  parentId: string | null
  /** Set on stage stories linked to contract payment stages 1–14 */
  stageNumber: number | null
  title: string
  description: string
  /** Empty string = unassigned (typical for epic/story) */
  assigneeId: string
  reporterId: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  createdAt: string
  updatedAt: string
  comments: TaskComment[]
}

export type NotificationKind = 'task_assigned'

export type AppNotification = {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string
  taskId: string
  read: boolean
  createdAt: string
}

export type ChecklistItem = {
  id: string
  section: string
  text: string
  required: boolean
}

export type ChecklistTemplate = {
  id: string
  name: string
  description: string
  editable: boolean
  items: ChecklistItem[]
}

export type ChecklistAnswer = { done: boolean; note: string }

export type ObjectChecklist = {
  id: string
  objectId: string
  templateId: string
  answers: Record<string, ChecklistAnswer>
}

export type ChecklistsData = {
  templates: ChecklistTemplate[]
  objectChecklists: ObjectChecklist[]
}

export type DailyReportStatus = 'draft' | 'submitted' | 'late'

export type DailyReport = {
  id: string
  objectId: string
  authorId: string
  date: string
  submittedAt: string | null
  status: DailyReportStatus
  summary: string
  mediaPaths: string[]
  clientVisible: boolean
}

export type DailyReportsData = {
  deadlineLocal: string
  timezoneNote: string
  reports: DailyReport[]
}

export type FunnelEvent = {
  id: string
  objectId: string
  stage: string
  at: string
  byUserId: string
  note: string
}

export type SessionPayload = {
  userId: string
  role: Role
  name: string
  login: string
  exp: number
}
