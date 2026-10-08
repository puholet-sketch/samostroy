import { repository } from '../repository/JsonRepository'
import type {
  AppNotification,
  ChecklistsData,
  DailyReportsData,
  IssueType,
  ModuleKey,
  PermissionsData,
  RenovationObject,
  Role,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from '../types'
import {
  DESIGN_STORY_TITLE,
  EPIC_TITLE,
  REPAIR_STORY_TITLE,
  defaultChildType,
  epicsForObject,
  normalizeIssue,
} from '../../lib/issues'

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

async function notifyAssignee(
  task: Task,
  opts?: { previousAssigneeId?: string | null; actorId?: string },
): Promise<void> {
  if (task.issueType !== 'task' || !task.assigneeId) return
  const prevAssignee = opts?.previousAssigneeId
  const assigneeChanged =
    task.assigneeId !== prevAssignee && task.assigneeId !== opts?.actorId
  if (!assigneeChanged) return

  const users = await repository.getUsers()
  const actor = users.find((u) => u.id === opts?.actorId)
  const items = await repository.getNotifications()
  const note: AppNotification = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: task.assigneeId,
    kind: 'task_assigned',
    title: 'Вам назначена задача',
    body: actor
      ? `${actor.name} назначил(а) вам: «${task.title}»`
      : `Вам назначена задача: «${task.title}»`,
    taskId: task.id,
    read: false,
    createdAt: new Date().toISOString(),
  }
  items.unshift(note)
  await repository.saveNotifications(items.slice(0, 100))
}

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
    get: (id: string) => repository.getTask(id),
    save: async (task: Task, opts?: { previousAssigneeId?: string | null; actorId?: string }) => {
      await repository.saveTask(normalizeIssue(task))
      await notifyAssignee(task, opts)
    },
    /** Create Design + Repair + 14 stage stories under epic for object (idempotent). */
    ensureStructureFromTemplate: async (
      objectId: string,
      opts?: { actorId?: string },
    ): Promise<{ created: number; epicId: string }> => {
      const now = new Date().toISOString()
      const actorId = opts?.actorId ?? 'u-owner'
      const template = await repository.getStageTemplate()
      let all = await repository.getTasks()
      let created = 0

      let epic = epicsForObject(all, objectId)[0]
      if (!epic) {
        epic = normalizeIssue({
          id: newId('epic'),
          objectId,
          issueType: 'epic',
          parentId: null,
          title: EPIC_TITLE,
          description: 'Эпик объекта: дизайн и ремонт по этапам-актам.',
          assigneeId: '',
          reporterId: actorId,
          status: 'todo',
          priority: 'high',
          createdAt: now,
          updatedAt: now,
        })
        all.push(epic)
        created++
      }

      let design = all.find(
        (i) =>
          i.objectId === objectId &&
          i.issueType === 'story' &&
          i.parentId === epic.id &&
          i.title === DESIGN_STORY_TITLE &&
          i.stageNumber == null,
      )
      if (!design) {
        design = normalizeIssue({
          id: newId('story'),
          objectId,
          issueType: 'story',
          parentId: epic.id,
          title: DESIGN_STORY_TITLE,
          description: 'История: дизайн-проект и согласования с клиентом.',
          assigneeId: '',
          reporterId: actorId,
          status: 'todo',
          priority: 'medium',
          createdAt: now,
          updatedAt: now,
        })
        all.push(design)
        created++
      }

      let repair = all.find(
        (i) =>
          i.objectId === objectId &&
          i.issueType === 'story' &&
          i.parentId === epic.id &&
          i.title === REPAIR_STORY_TITLE &&
          i.stageNumber == null,
      )
      if (!repair) {
        repair = normalizeIssue({
          id: newId('story'),
          objectId,
          issueType: 'story',
          parentId: epic.id,
          title: REPAIR_STORY_TITLE,
          description:
            'История-контейнер ремонта; этапы 1–14 — дочерние истории (акты оплаты).',
          assigneeId: '',
          reporterId: actorId,
          status: 'todo',
          priority: 'high',
          createdAt: now,
          updatedAt: now,
        })
        all.push(repair)
        created++
      }

      for (const s of template.stages) {
        const exists = all.some(
          (i) =>
            i.objectId === objectId &&
            i.issueType === 'story' &&
            i.parentId === repair!.id &&
            i.stageNumber === s.n,
        )
        if (exists) continue
        all.push(
          normalizeIssue({
            id: newId('story'),
            objectId,
            issueType: 'story',
            parentId: repair.id,
            stageNumber: s.n,
            title: `Этап ${s.n}. ${s.name}`,
            description: `Акт/этап оплаты №${s.n}: ${s.name}`,
            assigneeId: '',
            reporterId: actorId,
            status: 'todo',
            priority: 'medium',
            createdAt: now,
            updatedAt: now,
          }),
        )
        created++
      }

      await repository.saveTasks(all)
      return { created, epicId: epic.id }
    },
    createChild: async (
      parentId: string,
      opts: {
        actorId: string
        title?: string
        description?: string
        issueType?: IssueType
        assigneeId?: string
        status?: TaskStatus
        priority?: TaskPriority
        dueDate?: string | null
      },
    ): Promise<Task | null> => {
      const parent = await repository.getTask(parentId)
      if (!parent || parent.issueType === 'task') return null

      const issueType = opts.issueType ?? defaultChildType(parent)
      if (parent.issueType === 'epic' && issueType !== 'story') return null
      if (parent.issueType === 'story' && issueType !== 'task' && issueType !== 'story') {
        return null
      }

      const now = new Date().toISOString()
      const title =
        opts.title?.trim() ||
        (issueType === 'story' ? 'Новая история' : 'Новая задача')
      const child = normalizeIssue({
        id: newId(issueType === 'story' ? 'story' : 'task'),
        objectId: parent.objectId,
        issueType,
        parentId: parent.id,
        stageNumber: null,
        title,
        description: opts.description ?? '',
        assigneeId: opts.assigneeId ?? '',
        reporterId: opts.actorId,
        status: opts.status ?? 'todo',
        priority: opts.priority ?? 'medium',
        dueDate: opts.dueDate ?? null,
        createdAt: now,
        updatedAt: now,
      })
      await repository.saveTask(child)
      if (child.issueType === 'task' && child.assigneeId) {
        await notifyAssignee(child, {
          previousAssigneeId: null,
          actorId: opts.actorId,
        })
      }
      return child
    },
    /** Create a board task (under a story). Ensures object structure if needed. */
    create: async (opts: {
      actorId: string
      objectId: string
      parentId?: string | null
      title: string
      description?: string
      assigneeId?: string
      status?: TaskStatus
      priority?: TaskPriority
      dueDate?: string | null
      issueType?: IssueType
    }): Promise<Task> => {
      const issueType = opts.issueType ?? 'task'
      let parentId = opts.parentId ?? null

      if (issueType === 'task') {
        if (parentId) {
          const parent = await repository.getTask(parentId)
          if (!parent || parent.issueType === 'task') {
            parentId = null
          }
        }
        if (!parentId) {
          let all = await repository.getTasks()
          let story =
            all.find(
              (i) =>
                i.objectId === opts.objectId &&
                i.issueType === 'story' &&
                i.title === REPAIR_STORY_TITLE &&
                i.stageNumber == null,
            ) ??
            all.find(
              (i) =>
                i.objectId === opts.objectId &&
                i.issueType === 'story' &&
                i.stageNumber == null,
            ) ??
            all.find((i) => i.objectId === opts.objectId && i.issueType === 'story')
          if (!story) {
            await api.tasks.ensureStructureFromTemplate(opts.objectId, {
              actorId: opts.actorId,
            })
            all = await repository.getTasks()
            story =
              all.find(
                (i) =>
                  i.objectId === opts.objectId &&
                  i.issueType === 'story' &&
                  i.title === REPAIR_STORY_TITLE &&
                  i.stageNumber == null,
              ) ?? all.find((i) => i.objectId === opts.objectId && i.issueType === 'story')
          }
          parentId = story?.id ?? null
        }
      }

      if (issueType !== 'epic' && !parentId && issueType === 'task') {
        throw new Error('Не удалось определить родительскую историю для задачи')
      }

      if (parentId && (issueType === 'story' || issueType === 'task')) {
        const child = await api.tasks.createChild(parentId, {
          actorId: opts.actorId,
          title: opts.title,
          description: opts.description,
          issueType,
          assigneeId: opts.assigneeId,
          status: opts.status,
          priority: opts.priority,
          dueDate: opts.dueDate,
        })
        if (!child) throw new Error('Не удалось создать элемент')
        return child
      }

      const now = new Date().toISOString()
      const created = normalizeIssue({
        id: newId(issueType),
        objectId: opts.objectId,
        issueType,
        parentId: null,
        title: opts.title.trim() || 'Новый эпик',
        description: opts.description ?? '',
        assigneeId: opts.assigneeId ?? '',
        reporterId: opts.actorId,
        status: opts.status ?? 'todo',
        priority: opts.priority ?? 'medium',
        dueDate: opts.dueDate ?? null,
        createdAt: now,
        updatedAt: now,
      })
      await repository.saveTask(created)
      return created
    },
    remove: async (id: string): Promise<void> => {
      await repository.deleteTask(id)
    },
  },
  notifications: {
    list: () => repository.getNotifications(),
    forUser: async (userId: string) => {
      const all = await repository.getNotifications()
      return all.filter((n) => n.userId === userId)
    },
    saveAll: (items: AppNotification[]) => repository.saveNotifications(items),
    markRead: async (id: string) => {
      const all = await repository.getNotifications()
      const next = all.map((n) => (n.id === id ? { ...n, read: true } : n))
      await repository.saveNotifications(next)
      return next
    },
    markAllRead: async (userId: string) => {
      const all = await repository.getNotifications()
      const next = all.map((n) => (n.userId === userId ? { ...n, read: true } : n))
      await repository.saveNotifications(next)
      return next
    },
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
