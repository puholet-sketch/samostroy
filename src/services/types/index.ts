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

export type Task = {
  id: string
  objectId: string
  title: string
  assigneeId: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
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
