import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { IssueType, Task, TaskPriority, TaskStatus, User } from '../../services/types'
import { useObjects } from '../../hooks/useObjects'
import { formatDateRu, initialsFromName } from '../../lib/userDisplay'
import { ISSUE_TYPE_LABEL, childrenOf, isKanbanCard } from '../../lib/issues'
import { deleteMediaBlobs } from '../../lib/mediaStore'
import IssueTypeBadge from './IssueTypeBadge'
import TaskCreateModal, { type TaskCreatePayload } from './TaskCreateModal'

const DND_MIME = 'application/x-samostroy-task'

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'К выполнению' },
  { status: 'in_progress', title: 'В работе' },
  { status: 'waiting_client', title: 'Ждём клиента' },
  { status: 'paused', title: 'Пауза' },
  { status: 'done', title: 'Готово' },
]

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: 'bg-gray-300',
  medium: 'bg-accent-400',
  high: 'bg-red-500',
}

type ViewMode = 'board' | 'structure'

export default function TasksPage() {
  const { can, user } = useAuth()
  const { objects } = useObjects()
  const navigate = useNavigate()
  const [issues, setIssues] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [view, setView] = useState<ViewMode>('board')
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all')
  const [objectFilter, setObjectFilter] = useState<string>('all')
  const [templateBusy, setTemplateBusy] = useState(false)
  const [templateMsg, setTemplateMsg] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createStatus, setCreateStatus] = useState<TaskStatus>('todo')
  const dragMoved = useRef(false)
  const writable = can('tasks', 'write')

  const objectTitle = useMemo(() => {
    const m = new Map(objects.map((o) => [o.id, o.title]))
    return (id: string) => m.get(id) ?? id
  }, [objects])

  const userName = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u.name]))
    return (id: string) => (id ? m.get(id) ?? '?' : '—')
  }, [users])

  async function reload() {
    const [t, u] = await Promise.all([api.tasks.list(), api.users.list()])
    setIssues(t)
    setUsers(u)
  }

  useEffect(() => {
    void reload()
  }, [])

  const scoped = useMemo(() => {
    let list = issues
    if (objectFilter !== 'all') list = list.filter((i) => i.objectId === objectFilter)
    if (typeFilter !== 'all') list = list.filter((i) => i.issueType === typeFilter)
    return list
  }, [issues, objectFilter, typeFilter])

  const boardCards = useMemo(
    () => scoped.filter((i) => (typeFilter === 'all' ? isKanbanCard(i) : true)),
    [scoped, typeFilter],
  )

  async function move(task: Task, status: TaskStatus) {
    if (!writable || !user || task.status === status) return
    const next = { ...task, status, updatedAt: new Date().toISOString() }
    setIssues((prev) => prev.map((i) => (i.id === task.id ? next : i)))
    await api.tasks.save(next, { previousAssigneeId: task.assigneeId, actorId: user.id })
    await reload()
  }

  function onStatusChange(task: Task, e: ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    void move(task, e.target.value as TaskStatus)
  }

  function stopCardNav(e: MouseEvent) {
    e.stopPropagation()
  }

  function onCardDragStart(task: Task, e: DragEvent) {
    if (!writable) return
    dragMoved.current = false
    setDraggingId(task.id)
    e.dataTransfer.setData(DND_MIME, task.id)
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onCardDragEnd() {
    setDraggingId(null)
    setDropTarget(null)
  }

  function onColumnDragOver(status: TaskStatus, e: DragEvent) {
    if (!writable) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropTarget !== status) setDropTarget(status)
  }

  function onColumnDragLeave(status: TaskStatus, e: DragEvent) {
    const related = e.relatedTarget as Node | null
    if (related && (e.currentTarget as HTMLElement).contains(related)) return
    if (dropTarget === status) setDropTarget(null)
  }

  function onColumnDrop(status: TaskStatus, e: DragEvent) {
    e.preventDefault()
    setDropTarget(null)
    const id = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain')
    setDraggingId(null)
    if (!id) return
    const task = issues.find((i) => i.id === id)
    if (!task) return
    dragMoved.current = true
    void move(task, status)
  }

  async function runTemplateForObject(objectId: string) {
    if (!writable || !user) return
    setTemplateBusy(true)
    setTemplateMsg('')
    const res = await api.tasks.ensureStructureFromTemplate(objectId, { actorId: user.id })
    setTemplateMsg(
      res.created > 0
        ? `Создано элементов: ${res.created}`
        : 'Структура уже существует',
    )
    await reload()
    setTemplateBusy(false)
    setView('structure')
  }

  function openCreate(status: TaskStatus = 'todo') {
    setCreateStatus(status)
    setCreateOpen(true)
  }

  async function handleCreate(payload: TaskCreatePayload) {
    if (!user) return
    const created = await api.tasks.create({
      actorId: user.id,
      objectId: payload.objectId,
      parentId: payload.parentId,
      issueType: payload.issueType,
      title: payload.title,
      description: payload.description,
      assigneeId: payload.assigneeId,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate,
    })
    await reload()
    navigate(`/tasks/${created.id}`)
  }

  async function handleDelete(task: Task, e: MouseEvent) {
    e.stopPropagation()
    if (!writable) return
    const label =
      task.issueType === 'task'
        ? 'задачу'
        : task.issueType === 'story'
          ? 'историю и все дочерние элементы'
          : 'эпик и всю структуру'
    if (!window.confirm(`Удалить ${label} «${task.title}»?`)) return
    const treeIds: string[] = []
    const walk = (id: string) => {
      treeIds.push(id)
      for (const c of issues.filter((x) => x.parentId === id)) walk(c.id)
    }
    walk(task.id)
    const mediaIds = issues
      .filter((i) => treeIds.includes(i.id))
      .flatMap((i) => i.attachments.map((a) => a.id))
    await deleteMediaBlobs(mediaIds)
    await api.tasks.remove(task.id)
    await reload()
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Задачи</h1>
          <p className="text-sm text-gray-500 mt-1">
            Эпик → История → Задача · перетаскивайте карточки между колонками
            <span className="lg:hidden"> · листайте колонки горизонтально</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {writable && (
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => openCreate('todo')}>
              + Создать
            </button>
          )}
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 w-full sm:w-auto">
            <button
              type="button"
              className={`flex-1 sm:flex-none min-h-11 px-3 py-2 text-sm rounded-md ${
                view === 'board' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setView('board')}
            >
              Доска
            </button>
            <button
              type="button"
              className={`flex-1 sm:flex-none min-h-11 px-3 py-2 text-sm rounded-md ${
                view === 'structure'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setView('structure')}
            >
              Структура
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
        <div className="w-full sm:w-auto sm:min-w-[200px] flex-1 sm:flex-none">
          <label className="label">Объект</label>
          <select
            className="input w-full"
            value={objectFilter}
            onChange={(e) => setObjectFilter(e.target.value)}
          >
            <option value="all">Все объекты</option>
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[140px]">
          <label className="label">Тип</label>
          <select
            className="input w-full"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as IssueType | 'all')}
          >
            <option value="all">Все типы</option>
            {(Object.keys(ISSUE_TYPE_LABEL) as IssueType[]).map((t) => (
              <option key={t} value={t}>
                {ISSUE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {writable && objectFilter !== 'all' && (
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={templateBusy}
            onClick={() => void runTemplateForObject(objectFilter)}
          >
            {templateBusy ? 'Создание…' : 'Создать структуру по шаблону'}
          </button>
        )}
        {templateMsg && <p className="text-sm text-green-600 self-center">{templateMsg}</p>}
      </div>

      {view === 'board' ? (
        <div className="kanban-scroll lg:grid lg:grid-cols-3 xl:grid-cols-5 lg:overflow-visible lg:snap-none lg:gap-3 lg:pb-0 lg:mx-0 lg:px-0">
          {COLUMNS.map((col) => {
            const items = boardCards.filter((t) => t.status === col.status)
            const isOver = dropTarget === col.status
            return (
              <div
                key={col.status}
                onDragOver={(e) => onColumnDragOver(col.status, e)}
                onDragLeave={(e) => onColumnDragLeave(col.status, e)}
                onDrop={(e) => onColumnDrop(col.status, e)}
                className={`kanban-column card p-3 flex flex-col gap-3 min-h-[200px] max-h-[70vh] lg:max-h-none lg:w-auto lg:shrink transition-colors ${
                  isOver
                    ? 'bg-primary-50 ring-2 ring-primary-400 ring-inset'
                    : 'bg-gray-50/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 min-h-[2.5rem] shrink-0 pointer-events-none">
                  <h2 className="text-sm font-semibold text-gray-800 leading-snug">{col.title}</h2>
                  <span className="badge-gray shrink-0 mt-0.5">{items.length}</span>
                </div>
              <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                {items.length === 0 && writable && (
                  <div
                    className={`rounded-lg border border-dashed text-xs text-center py-6 px-2 ${
                      isOver
                        ? 'border-primary-400 text-primary-600 bg-primary-50/50'
                        : 'border-gray-200 text-gray-400'
                    }`}
                  >
                    Перетащите сюда
                  </div>
                )}
                {items.map((t) => {
                    const name = userName(t.assigneeId)
                    const isDragging = draggingId === t.id
                    return (
                      <div
                        key={t.id}
                        role="link"
                        tabIndex={0}
                        draggable={writable}
                        onDragStart={(e) => onCardDragStart(t, e)}
                        onDrag={() => {
                          dragMoved.current = true
                        }}
                        onDragEnd={onCardDragEnd}
                        onClick={() => {
                          if (dragMoved.current) {
                            dragMoved.current = false
                            return
                          }
                          navigate(`/tasks/${t.id}`)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate(`/tasks/${t.id}`)
                          }
                        }}
                        className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col gap-1.5 hover:border-primary-300 hover:shadow transition-all text-left ${
                          writable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        } ${isDragging ? 'opacity-40 ring-2 ring-primary-300' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`}
                            title={t.priority}
                          />
                          <div className="text-sm font-medium text-gray-900 leading-snug min-h-[2.5rem] line-clamp-2 flex-1">
                            {t.title}
                          </div>
                          {writable && (
                            <button
                              type="button"
                              className="text-gray-400 hover:text-red-600 text-xs shrink-0 px-1 min-h-8"
                              title="Удалить"
                              onClick={(e) => void handleDelete(t, e)}
                              onMouseDown={stopCardNav}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <IssueTypeBadge type={t.issueType} />
                          {t.stageNumber != null && (
                            <span className="badge-gray">Этап {t.stageNumber}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate leading-5 min-h-5">
                          {objectTitle(t.objectId)}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span
                            className="h-6 w-6 rounded-full bg-primary-600 text-white text-[10px] font-semibold flex items-center justify-center"
                            title={name}
                          >
                            {initialsFromName(name === '—' ? '?' : name)}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {(t.attachments?.length ?? 0) > 0 && (
                              <span title="Вложения">📎 {t.attachments.length}</span>
                            )}
                            <span>до {formatDateRu(t.dueDate)}</span>
                          </div>
                        </div>
                        {writable && t.issueType === 'task' && (
                          <select
                            className="input mt-1 text-xs py-1 w-full"
                            value={t.status}
                            onClick={stopCardNav}
                            onMouseDown={stopCardNav}
                            onChange={(e) => onStatusChange(t, e)}
                          >
                            {COLUMNS.map((c) => (
                              <option key={c.status} value={c.status}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card p-4 space-y-1">
          {(objectFilter === 'all' ? objects : objects.filter((o) => o.id === objectFilter)).map(
            (o) => {
              const epic = issues.find(
                (i) => i.objectId === o.id && i.issueType === 'epic' && !i.parentId,
              )
              const treeSource =
                typeFilter === 'all'
                  ? issues.filter((i) => i.objectId === o.id)
                  : issues.filter((i) => i.objectId === o.id && i.issueType === typeFilter)
              return (
                <div key={o.id} className="mb-4 last:mb-0">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                    {o.title}
                  </div>
                  {typeFilter === 'all' && epic ? (
                    <StructureNode
                      issue={epic}
                      all={issues.filter((i) => i.objectId === o.id)}
                      depth={0}
                      onOpen={(id) => navigate(`/tasks/${id}`)}
                    />
                  ) : treeSource.length > 0 ? (
                    treeSource
                      .filter((i) => typeFilter !== 'all' || i.issueType === 'epic')
                      .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
                      .map((r) => (
                        <StructureNode
                          key={r.id}
                          issue={r}
                          all={issues.filter((i) => i.objectId === o.id)}
                          depth={0}
                          onOpen={(id) => navigate(`/tasks/${id}`)}
                        />
                      ))
                  ) : (
                    <p className="text-sm text-gray-400 px-2">
                      Нет элементов. Нажмите «Создать структуру по шаблону».
                    </p>
                  )}
                </div>
              )
            },
          )}
        </div>
      )}

      <TaskCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        objects={objects}
        issues={issues}
        users={users}
        defaultObjectId={objectFilter !== 'all' ? objectFilter : objects[0]?.id}
        defaultStatus={createStatus}
        defaultIssueType="task"
      />
    </div>
  )
}

function StructureNode({
  issue,
  all,
  depth,
  onOpen,
}: {
  issue: Task
  all: Task[]
  depth: number
  onOpen: (id: string) => void
}) {
  const kids = childrenOf(all, issue.id).sort((a, b) => {
    if (a.stageNumber != null && b.stageNumber != null) return a.stageNumber - b.stageNumber
    if (a.issueType !== b.issueType) {
      const order = { epic: 0, story: 1, task: 2 }
      return order[a.issueType] - order[b.issueType]
    }
    return a.title.localeCompare(b.title, 'ru')
  })

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpen(issue.id)}
        className="w-full flex items-center gap-2 px-2 py-2.5 min-h-11 rounded-md hover:bg-gray-50 text-left"
        style={{ paddingLeft: `${Math.min(depth, 4) * 12 + 8}px` }}
      >
        <IssueTypeBadge type={issue.issueType} />
        <span className="text-sm text-gray-900 flex-1 truncate">{issue.title}</span>
        {issue.stageNumber != null && (
          <span className="text-[11px] text-gray-400">акт {issue.stageNumber}</span>
        )}
        <span className="text-[11px] text-gray-400 shrink-0">
          {COLUMNS.find((c) => c.status === issue.status)?.title ?? issue.status}
        </span>
      </button>
      {kids.map((k) => (
        <StructureNode key={k.id} issue={k} all={all} depth={depth + 1} onOpen={onOpen} />
      ))}
    </div>
  )
}
