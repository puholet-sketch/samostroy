import type { IssueType, Task } from '../services/types'

export const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  epic: 'Эпик',
  story: 'История',
  task: 'Задача',
}

/** Jira-like badge colors: Epic purple, Story green, Task blue */
export const ISSUE_TYPE_BADGE: Record<IssueType, string> = {
  epic: 'badge-purple',
  story: 'badge-green',
  task: 'badge-blue',
}

export const DESIGN_STORY_TITLE = 'Дизайн'
export const REPAIR_STORY_TITLE = 'Ремонт'
export const EPIC_TITLE = 'Комплексный ремонт'

export function normalizeIssue(raw: Partial<Task> & Pick<Task, 'id' | 'objectId' | 'title'>): Task {
  const issueType = raw.issueType ?? 'task'
  return {
    id: raw.id,
    objectId: raw.objectId,
    issueType,
    parentId: raw.parentId ?? null,
    stageNumber: raw.stageNumber ?? null,
    title: raw.title,
    description: raw.description ?? '',
    assigneeId: raw.assigneeId ?? '',
    reporterId: raw.reporterId ?? '',
    status: raw.status ?? 'todo',
    priority: raw.priority ?? 'medium',
    dueDate: raw.dueDate ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    comments: raw.comments ?? [],
  }
}

export function childrenOf(all: Task[], parentId: string): Task[] {
  return all.filter((i) => i.parentId === parentId)
}

export function epicsForObject(all: Task[], objectId: string): Task[] {
  return all.filter((i) => i.objectId === objectId && i.issueType === 'epic' && !i.parentId)
}

/** Ancestors from root epic down to immediate parent (excludes self). */
export function breadcrumbChain(all: Task[], issue: Task): Task[] {
  const byId = new Map(all.map((i) => [i.id, i]))
  const chain: Task[] = []
  let cur = issue.parentId ? byId.get(issue.parentId) : undefined
  while (cur) {
    chain.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return chain
}

export function defaultChildType(parent: Task): IssueType {
  if (parent.issueType === 'epic') return 'story'
  return 'task'
}

export function canHaveChildren(issue: Task): boolean {
  return issue.issueType === 'epic' || issue.issueType === 'story'
}

export function isKanbanCard(issue: Task): boolean {
  return issue.issueType === 'task'
}
