import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { IssueType, Task, TaskPriority, TaskStatus, User } from '../../services/types'
import type { RenovationObject } from '../../services/types'
import { isAssignableUser } from '../../lib/userDisplay'
import { ISSUE_TYPE_LABEL } from '../../lib/issues'

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

const ROLE_LABEL: Record<string, string> = {
  owner: 'Директор',
  seller: 'Продавец',
  foreman: 'Прораб',
  builder: 'Строитель',
  supervisor: 'Надзор',
}

export type TaskCreatePayload = {
  objectId: string
  parentId: string | null
  issueType: IssueType
  title: string
  description: string
  assigneeId: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: TaskCreatePayload) => Promise<void>
  objects: RenovationObject[]
  issues: Task[]
  users: User[]
  defaultObjectId?: string
  defaultParentId?: string | null
  defaultStatus?: TaskStatus
  defaultIssueType?: IssueType
}

export default function TaskCreateModal({
  open,
  onClose,
  onSubmit,
  objects,
  issues,
  users,
  defaultObjectId = '',
  defaultParentId = null,
  defaultStatus = 'todo',
  defaultIssueType = 'task',
}: Props) {
  const assignees = useMemo(() => users.filter(isAssignableUser), [users])
  const [objectId, setObjectId] = useState(defaultObjectId)
  const [parentId, setParentId] = useState(defaultParentId ?? '')
  const [issueType, setIssueType] = useState<IssueType>(defaultIssueType)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setObjectId(defaultObjectId || objects[0]?.id || '')
    setParentId(defaultParentId ?? '')
    setIssueType(defaultIssueType)
    setTitle('')
    setDescription('')
    setAssigneeId('')
    setStatus(defaultStatus)
    setPriority('medium')
    setDueDate('')
    setError('')
  }, [open, defaultObjectId, defaultParentId, defaultStatus, defaultIssueType, objects])

  const parentOptions = useMemo(() => {
    if (!objectId) return []
    return issues
      .filter((i) => i.objectId === objectId && i.issueType !== 'task')
      .sort((a, b) => {
        if (a.issueType !== b.issueType) {
          const order = { epic: 0, story: 1, task: 2 }
          return order[a.issueType] - order[b.issueType]
        }
        if (a.stageNumber != null && b.stageNumber != null) return a.stageNumber - b.stageNumber
        return a.title.localeCompare(b.title, 'ru')
      })
  }, [issues, objectId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!objectId || !title.trim()) {
      setError('Укажите объект и название')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        objectId,
        parentId: parentId || null,
        issueType,
        title: title.trim(),
        description: description.trim(),
        assigneeId,
        status,
        priority,
        dueDate: dueDate || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-create-title"
      onClick={onClose}
    >
      <form
        className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl shadow-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="task-create-title" className="text-lg font-semibold text-gray-900">
            Новый элемент
          </h2>
          <button type="button" className="btn-secondary min-h-10 px-3 py-1.5 text-sm" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div>
          <label className="label">Тип</label>
          <select
            className="input"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as IssueType)}
          >
            {(Object.keys(ISSUE_TYPE_LABEL) as IssueType[]).map((t) => (
              <option key={t} value={t}>
                {ISSUE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Объект *</label>
          <select
            className="input"
            value={objectId}
            onChange={(e) => {
              setObjectId(e.target.value)
              setParentId('')
            }}
            required
          >
            <option value="">Выберите объект</option>
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>

        {issueType !== 'epic' && (
          <div>
            <label className="label">
              Родитель {issueType === 'task' ? '(история)' : '(эпик)'}
            </label>
            <select
              className="input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">
                {issueType === 'task' ? 'Авто: история «Ремонт»' : 'Без родителя / авто'}
              </option>
              {parentOptions
                .filter((p) => (issueType === 'task' ? p.issueType === 'story' : p.issueType === 'epic'))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {ISSUE_TYPE_LABEL[p.issueType]}: {p.title}
                    {p.stageNumber != null ? ` (этап ${p.stageNumber})` : ''}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Название *</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Кратко, что сделать"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label">Описание</label>
          <textarea
            className="input min-h-[88px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Детали, контекст…"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Статус</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Приоритет</label>
            <select
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Исполнитель</label>
            <select
              className="input"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Не назначен</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {ROLE_LABEL[u.role] ?? u.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Срок</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
            {busy ? 'Сохранение…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
