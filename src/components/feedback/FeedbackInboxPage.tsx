import { useCallback, useEffect, useMemo, useState } from 'react'
import { RiFileCopyLine } from '@remixicon/react'
import { Panel } from '../ui/Kpi'
import {
  executorBriefFor,
  FEEDBACK_KIND_LABEL,
  FEEDBACK_STATUS_LABEL,
  getFeedback,
  listFeedback,
  loadFeedbackImage,
  mergeRemoteFeedback,
  updateFeedbackStatus,
  type FeedbackItem,
  type FeedbackStatus,
} from '../../lib/feedbackStore'
import {
  fetchFeedbackList,
  patchFeedbackStatusRemote,
  remoteImageUrl,
} from '../../lib/feedbackApi'
import { isFeedbackApiConfigured } from '../../lib/feedbackConfig'
import { useAuth } from '../../contexts/AuthContext'

type Filter = 'open' | 'all' | FeedbackStatus

export default function FeedbackInboxPage() {
  const { user, can } = useAuth()
  const canCopyBrief =
    user?.role === 'owner' ||
    user?.role === 'developer' ||
    can('security', 'write')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<Filter>('open')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [syncing, setSyncing] = useState(false)

  const reload = useCallback(() => {
    setItems(listFeedback())
  }, [])

  const syncRemote = useCallback(async () => {
    if (!isFeedbackApiConfigured()) return
    setSyncing(true)
    try {
      const remote = await fetchFeedbackList()
      mergeRemoteFeedback(remote)
      reload()
      setMsg('Синхронизировано с API')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка sync')
    } finally {
      setSyncing(false)
    }
  }, [reload])

  useEffect(() => {
    document.title = 'Замечания — СамоСтрой'
    reload()
    void syncRemote()
  }, [reload, syncRemote])

  const filtered = useMemo(() => {
    let list = items
    if (filter === 'open') list = list.filter((x) => x.status !== 'done')
    else if (filter !== 'all') list = list.filter((x) => x.status === filter)
    const query = q.trim().toLowerCase()
    if (query) {
      list = list.filter(
        (x) =>
          x.title.toLowerCase().includes(query) ||
          x.body.toLowerCase().includes(query) ||
          x.id.toLowerCase().includes(query),
      )
    }
    return list
  }, [items, filter, q])

  const selected = selectedId ? getFeedback(selectedId) ?? items.find((x) => x.id === selectedId) : null

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    ;(async () => {
      if (!selected) {
        setPreviewUrl(null)
        return
      }
      const blob = await loadFeedbackImage(selected.imageId)
      if (cancelled) return
      if (blob) {
        const url = URL.createObjectURL(blob)
        revoked = url
        setPreviewUrl(url)
        return
      }
      const remote = remoteImageUrl(selected.id)
      setPreviewUrl(remote)
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [selected?.id, selected?.imageId])

  async function setStatus(id: string, status: FeedbackStatus) {
    updateFeedbackStatus(id, status)
    try {
      await patchFeedbackStatusRemote(id, status)
    } catch {
      /* local ok */
    }
    reload()
    setMsg(`Статус: ${FEEDBACK_STATUS_LABEL[status]}`)
  }

  async function copyBrief(item: FeedbackItem) {
    const text = executorBriefFor(item)
    try {
      await navigator.clipboard.writeText(text)
      setMsg('Постановка скопирована')
    } catch {
      setMsg('Не удалось скопировать')
    }
  }

  function formatAt(iso: string) {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-gray-500">
          Очередь замечаний по системе. Открытые ждут обработки.
        </p>
        <div className="flex flex-wrap gap-2">
          {isFeedbackApiConfigured() && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void syncRemote()}
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {syncing ? '…' : 'Обновить с API'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['open', 'Открытые'],
            ['new', 'Новые'],
            ['in_progress', 'В работе'],
            ['done', 'Сделано'],
            ['all', 'Все'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filter === id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        <input
          className="min-w-[10rem] flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="Поиск по теме…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {msg && <p className="text-xs text-emerald-700">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Список · ${filtered.length}`}>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500">Пока нет замечаний.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full px-1 py-2.5 text-left hover:bg-gray-50 ${
                      selectedId === item.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          item.status === 'new'
                            ? 'bg-rose-100 text-rose-700'
                            : item.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {FEEDBACK_STATUS_LABEL[item.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {formatAt(item.createdAt)} · {item.authorName} ·{' '}
                      {FEEDBACK_KIND_LABEL[item.kind]}
                      {item.syncStatus === 'pending' || item.syncStatus === 'error'
                        ? ' · sync…'
                        : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={selected ? selected.title : 'Карточка'}>
          {!selected ? (
            <p className="text-sm text-gray-500">Выберите замечание слева.</p>
          ) : (
            <div className="space-y-3">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Скрин с разметкой"
                  className="max-h-64 w-full rounded-md border border-gray-200 object-contain bg-gray-50"
                />
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-gray-400">Id</dt>
                <dd className="font-mono text-gray-700">{selected.id}</dd>
                <dt className="text-gray-400">Дата</dt>
                <dd>{formatAt(selected.createdAt)}</dd>
                <dt className="text-gray-400">Автор</dt>
                <dd>
                  {selected.authorName} ({selected.authorRole})
                </dd>
                <dt className="text-gray-400">Страница</dt>
                <dd>
                  {selected.pageTitle} · <span className="font-mono">{selected.route}</span>
                </dd>
                <dt className="text-gray-400">Сборка</dt>
                <dd>{selected.buildStamp}</dd>
              </dl>
              {selected.body && (
                <p className="whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800">
                  {selected.body}
                </p>
              )}
              {selected.markers.length > 0 && (
                <ul className="text-xs text-gray-600">
                  {selected.markers.map((m) => (
                    <li key={m.id}>
                      {m.label}. {m.type}
                      {m.note ? ` — ${m.note}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {selected.status === 'new' && (
                  <button
                    type="button"
                    className="rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void setStatus(selected.id, 'in_progress')}
                  >
                    В работу
                  </button>
                )}
                {selected.status !== 'done' && (
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void setStatus(selected.id, 'done')}
                  >
                    Сделано
                  </button>
                )}
                {selected.status === 'done' && (
                  <button
                    type="button"
                    className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium"
                    onClick={() => void setStatus(selected.id, 'new')}
                  >
                    Снова открыть
                  </button>
                )}
                {canCopyBrief && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700"
                    onClick={() => void copyBrief(selected)}
                  >
                    <RiFileCopyLine className="h-3.5 w-3.5" />
                    Скопировать постановку
                  </button>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
