import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import { useObjects } from '../../hooks/useObjects'
import type { Task, TaskAttachment, TaskPriority, TaskStatus, User } from '../../services/types'
import {
  formatDateRu,
  formatDateTimeRu,
  initialsFromName,
  isAssignableUser,
} from '../../lib/userDisplay'
import { breadcrumbChain, canHaveChildren } from '../../lib/issues'
import { deleteMediaBlobs } from '../../lib/mediaStore'
import IssueTypeBadge from './IssueTypeBadge'
import TaskCreateModal, { type TaskCreatePayload } from './TaskCreateModal'
import TaskAttachmentsPanel from './TaskAttachmentsPanel'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  waiting_client: 'Ждём клиента',
  paused: 'Пауза',
  done: 'Готово',
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'badge-gray',
  medium: 'badge-yellow',
  high: 'badge-red',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Директор',
  seller: 'Продавец',
  foreman: 'Прораб',
  builder: 'Строитель',
  supervisor: 'Надзор',
}

function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const { objects } = useObjects()
  const [task, setTask] = useState<Task | null>(null)
  const [allIssues, setAllIssues] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const writable = can('tasks', 'write')

  const userById = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u]))
    return (uid: string) => m.get(uid)
  }, [users])

  const assignees = useMemo(() => users.filter(isAssignableUser), [users])

  const objectTitle = useMemo(() => {
    const m = new Map(objects.map((o) => [o.id, o.title]))
    return (oid: string) => m.get(oid) ?? oid
  }, [objects])

  async function reload() {
    if (!id) return
    setLoading(true)
    const [t, u, all] = await Promise.all([
      api.tasks.get(id),
      api.users.list(),
      api.tasks.list(),
    ])
    setTask(t)
    setUsers(u)
    setAllIssues(all)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [id])

  useEffect(() => {
    if (task) {
      document.title = `${task.title} — СамоСтрой`
    }
    return () => {
      document.title = 'СамоСтрой — CRM ремонта'
    }
  }, [task])

  async function persist(next: Task, previousAssigneeId?: string) {
    if (!user) return
    setSaving(true)
    await api.tasks.save(next, {
      previousAssigneeId: previousAssigneeId ?? task?.assigneeId,
      actorId: user.id,
    })
    setTask(next)
    await refreshNotifications()
    setSaving(false)
  }

  async function onFieldChange<K extends keyof Task>(key: K, value: Task[K]) {
    if (!task || !writable) return
    const prevAssignee = task.assigneeId
    const next: Task = {
      ...task,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }
    await persist(next, prevAssignee)
  }

  async function onAddComment(e: FormEvent) {
    e.preventDefault()
    if (!task || !user || !writable || !commentText.trim()) return
    const next: Task = {
      ...task,
      updatedAt: new Date().toISOString(),
      comments: [
        ...task.comments,
        {
          id: `c-${Date.now()}`,
          authorId: user.id,
          text: commentText.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    }
    setCommentText('')
    await persist(next)
  }

  async function onDelete() {
    if (!task || !writable) return
    const label =
      task.issueType === 'task'
        ? 'задачу'
        : task.issueType === 'story'
          ? 'историю и все дочерние элементы'
          : 'эпик и всю структуру'
    if (!window.confirm(`Удалить ${label} «${task.title}»?`)) return
    setDeleting(true)
    const mediaIds = [
      ...task.attachments.map((a) => a.id),
      ...allIssues
        .filter((i) => {
          // collect attachments from this issue only; cascade delete of children
          // cleans their meta but blobs for other issues remain — wipe this tree's known ids
          const chain: string[] = []
          const walk = (id: string) => {
            chain.push(id)
            for (const c of allIssues.filter((x) => x.parentId === id)) walk(c.id)
          }
          walk(task.id)
          return chain.includes(i.id)
        })
        .flatMap((i) => i.attachments.map((a) => a.id)),
    ]
    await deleteMediaBlobs([...new Set(mediaIds)])
    await api.tasks.remove(task.id)
    navigate('/tasks')
  }

  async function onAttachmentsChange(next: TaskAttachment[]) {
    if (!task || !writable) return
    const updated: Task = {
      ...task,
      attachments: next,
      updatedAt: new Date().toISOString(),
    }
    await persist(updated)
  }

  async function handleCreateChild(payload: TaskCreatePayload) {
    if (!user || !task) return
    const created = await api.tasks.create({
      actorId: user.id,
      objectId: payload.objectId,
      parentId: payload.parentId ?? task.id,
      issueType: payload.issueType,
      title: payload.title,
      description: payload.description,
      assigneeId: payload.assigneeId,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate,
    })
    navigate(`/tasks/${created.id}`)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка задачи…</p>
  }

  if (!task) {
    return (
      <div className="card p-6 sm:p-8 text-center">
        <p className="text-gray-700">Задача не найдена</p>
        <Link to="/tasks" className="btn-primary mt-4 inline-flex">
          К доске
        </Link>
      </div>
    )
  }

  const assignee = userById(task.assigneeId)
  const reporter = userById(task.reporterId)
  const issueType = task.issueType ?? 'task'
  const crumbs = breadcrumbChain(allIssues, task)

  const sidebar = (
    <aside className="space-y-5">
      <MetaField label="Статус">
        {writable ? (
          <select
            className="input"
            value={task.status}
            disabled={saving}
            onChange={(e) => void onFieldChange('status', e.target.value as TaskStatus)}
          >
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-gray-800">{STATUS_LABEL[task.status]}</p>
        )}
      </MetaField>

      <MetaField label="Приоритет">
        {writable ? (
          <select
            className="input"
            value={task.priority}
            disabled={saving}
            onChange={(e) => void onFieldChange('priority', e.target.value as TaskPriority)}
          >
            {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-gray-800">{PRIORITY_LABEL[task.priority]}</p>
        )}
      </MetaField>

      <MetaField label="Исполнитель (ФИО)">
        {writable ? (
          <select
            className="input"
            value={task.assigneeId}
            disabled={saving}
            onChange={(e) => void onFieldChange('assigneeId', e.target.value)}
          >
            <option value="">Не назначен</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {ROLE_LABEL[u.role] ?? u.role}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-full bg-primary-600 text-white text-xs font-semibold flex items-center justify-center">
              {initialsFromName(assignee?.name ?? '?')}
            </span>
            <span className="text-sm text-gray-800">{assignee?.name ?? '—'}</span>
          </div>
        )}
      </MetaField>

      <MetaField label="Автор">
        <p className="text-sm text-gray-800">{reporter?.name ?? '—'}</p>
      </MetaField>

      <MetaField label="Срок">
        {writable ? (
          <input
            type="date"
            className="input"
            value={task.dueDate ?? ''}
            disabled={saving}
            onChange={(e) => void onFieldChange('dueDate', e.target.value || null)}
          />
        ) : (
          <p className="text-sm text-gray-800">{formatDateRu(task.dueDate)}</p>
        )}
      </MetaField>

      <MetaField label="Объект">
        <Link
          to={`/objects/${task.objectId}`}
          className="text-sm text-primary-600 hover:underline break-words"
        >
          {objectTitle(task.objectId)}
        </Link>
      </MetaField>

      <MetaField label="Тип">
        <IssueTypeBadge type={issueType} />
      </MetaField>

      <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
        <MetaField label="Создана">
          <p className="text-sm text-gray-600">{formatDateTimeRu(task.createdAt)}</p>
        </MetaField>
        <MetaField label="Обновлена">
          <p className="text-sm text-gray-600">{formatDateTimeRu(task.updatedAt)}</p>
        </MetaField>
      </div>
    </aside>
  )

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {/* Issue header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              to="/tasks"
              className="inline-flex items-center min-h-11 text-sm text-primary-600 hover:underline shrink-0"
            >
              ← К доске задач
            </Link>
            <span className="text-sm font-mono text-gray-400">{task.id}</span>
            <IssueTypeBadge type={issueType} />
          </div>
          {crumbs.length > 0 && (
            <nav
              className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500"
              aria-label="Иерархия"
            >
              {crumbs.map((c, i) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 min-w-0">
                  {i > 0 && <span className="text-gray-300">/</span>}
                  <Link
                    to={`/tasks/${c.id}`}
                    className="text-primary-600 hover:underline truncate max-w-[12rem] sm:max-w-xs"
                  >
                    {c.title}
                  </Link>
                </span>
              ))}
              <span className="text-gray-300">/</span>
              <span className="text-gray-700 truncate max-w-[12rem] sm:max-w-xs">{task.title}</span>
            </nav>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span className={PRIORITY_BADGE[task.priority]}>
            Приоритет: {PRIORITY_LABEL[task.priority]}
          </span>
          {writable && canHaveChildren(task) && (
            <button type="button" className="btn-secondary text-sm" onClick={() => setCreateOpen(true)}>
              + Дочерний
            </button>
          )}
          {writable && (
            <button
              type="button"
              className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
              disabled={deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? 'Удаление…' : 'Удалить'}
            </button>
          )}
        </div>
      </div>

      {/* Main + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] gap-4 lg:gap-6 items-start">
        <div className="min-w-0 space-y-4">
          <div className="card p-4 sm:p-6 space-y-5">
            {writable ? (
              <input
                className="input text-xl sm:text-2xl font-bold border-0 shadow-none px-0 focus:ring-0 min-h-0 py-1"
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                onBlur={(e) => void onFieldChange('title', e.target.value.trim() || task.title)}
              />
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                {task.title}
              </h1>
            )}

            <div>
              <label className="label">Описание</label>
              {writable ? (
                <textarea
                  className="input min-h-[120px]"
                  value={task.description}
                  onChange={(e) => setTask({ ...task, description: e.target.value })}
                  onBlur={(e) => void onFieldChange('description', e.target.value)}
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {task.description || '—'}
                </p>
              )}
            </div>
          </div>

          <TaskAttachmentsPanel
            attachments={task.attachments}
            writable={writable}
            authorId={user?.id ?? ''}
            busy={saving}
            onChange={onAttachmentsChange}
          />

          {/* Meta as sections on mobile; desktop uses sidebar */}
          <div className="card p-4 sm:p-6 lg:hidden">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Сведения</h2>
            {sidebar}
          </div>

          <div className="card p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Комментарии</h2>
            <ul className="space-y-3">
              {task.comments.length === 0 && (
                <li className="text-sm text-gray-400">Пока нет комментариев</li>
              )}
              {task.comments.map((c) => {
                const author = userById(c.authorId)
                return (
                  <li key={c.id} className="flex gap-3">
                    <span className="h-9 w-9 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center shrink-0">
                      {initialsFromName(author?.name ?? '?')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-gray-900">
                          {author?.name ?? 'Неизвестный'}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formatDateTimeRu(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                        {c.text}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>

            {writable && (
              <form
                onSubmit={(e) => void onAddComment(e)}
                className="flex flex-col gap-2 pt-2 border-t border-gray-100"
              >
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Написать комментарий…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn-primary self-stretch sm:self-start"
                  disabled={saving || !commentText.trim()}
                >
                  Отправить
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="hidden lg:block card p-5 sticky top-20">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Сведения</h2>
          {sidebar}
        </div>
      </div>

      <TaskCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateChild}
        objects={objects}
        issues={allIssues}
        users={users}
        defaultObjectId={task.objectId}
        defaultParentId={task.id}
        defaultIssueType={task.issueType === 'epic' ? 'story' : 'task'}
      />
    </div>
  )
}
