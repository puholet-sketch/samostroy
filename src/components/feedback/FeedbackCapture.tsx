import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLocation } from 'react-router-dom'
import { toPng } from 'html-to-image'
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiCheckboxBlankLine,
  RiCloseLine,
  RiMapPinLine,
  RiText,
} from '@remixicon/react'
import { useAuth } from '../../contexts/AuthContext'
import { BUILD_STAMP } from '../../lib/buildStamp'
import { composeAnnotatedPng } from '../../lib/feedbackAnnotate'
import { submitFeedbackWithSync } from '../../lib/feedbackApi'
import {
  saveFeedbackImage,
  type FeedbackKind,
  type FeedbackMarker,
  type FeedbackMarkerType,
} from '../../lib/feedbackStore'
import { routeTitle } from '../layout/routes'

type Step = 'shot' | 'mark' | 'form'

type Tool = FeedbackMarkerType

type Props = {
  open: boolean
  onClose: () => void
  onSubmitted?: (id: string) => void
}

export function FeedbackCapture({ open, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const location = useLocation()
  const [step, setStep] = useState<Step>('shot')
  const [shotUrl, setShotUrl] = useState<string | null>(null)
  const [shotBlob, setShotBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [tool, setTool] = useState<Tool>('rect')
  const [markers, setMarkers] = useState<FeedbackMarker[]>([])
  const [draft, setDraft] = useState<{ x: number; y: number; x2?: number; y2?: number } | null>(
    null,
  )
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<FeedbackKind>('ux')
  const imgRef = useRef<HTMLImageElement>(null)

  const reset = useCallback(() => {
    if (shotUrl) URL.revokeObjectURL(shotUrl)
    setShotUrl(null)
    setShotBlob(null)
    setStep('shot')
    setMarkers([])
    setDraft(null)
    setTitle('')
    setBody('')
    setKind('ux')
    setMsg('')
    setBusy(false)
    setTool('rect')
  }, [shotUrl])

  useEffect(() => {
    if (!open) return
    reset()
    void capture()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture once on open
  }, [open])

  async function capture() {
    setBusy(true)
    setMsg('')
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const node = document.documentElement
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        filter: (el) => {
          if (!(el instanceof HTMLElement)) return true
          return !el.closest('[data-feedback-ui]')
        },
      })
      const blob = await (await fetch(dataUrl)).blob()
      if (shotUrl) URL.revokeObjectURL(shotUrl)
      const url = URL.createObjectURL(blob)
      setShotBlob(blob)
      setShotUrl(url)
      setStep('mark')
    } catch {
      setMsg('Не удалось сделать снимок экрана')
      setStep('shot')
    } finally {
      setBusy(false)
    }
  }

  function pctFromEvent(e: ReactPointerEvent) {
    const img = imgRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return {
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (step !== 'mark') return
    const p = pctFromEvent(e)
    if (!p) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    if (tool === 'pin' || tool === 'text') {
      const label = String(markers.length + 1)
      let note: string | undefined
      if (tool === 'text') {
        note = window.prompt('Подпись на скрине') || undefined
        if (!note) return
      }
      setMarkers((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, type: tool, x: p.x, y: p.y, label, note },
      ])
      return
    }
    setDraft({ x: p.x, y: p.y, x2: p.x, y2: p.y })
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!draft) return
    const p = pctFromEvent(e)
    if (!p) return
    setDraft({ ...draft, x2: p.x, y2: p.y })
  }

  function onPointerUp() {
    if (!draft || draft.x2 == null || draft.y2 == null) {
      setDraft(null)
      return
    }
    const label = String(markers.length + 1)
    if (tool === 'rect') {
      const x = Math.min(draft.x, draft.x2)
      const y = Math.min(draft.y, draft.y2)
      const w = Math.abs(draft.x2 - draft.x)
      const h = Math.abs(draft.y2 - draft.y)
      if (w < 0.5 || h < 0.5) {
        setDraft(null)
        return
      }
      setMarkers((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, type: 'rect', x, y, w, h, label },
      ])
    } else if (tool === 'arrow') {
      setMarkers((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          type: 'arrow',
          x: draft.x,
          y: draft.y,
          x2: draft.x2,
          y2: draft.y2,
          label,
        },
      ])
    }
    setDraft(null)
  }

  async function onSubmit() {
    if (!user || !shotBlob) return
    const t = title.trim()
    if (!t) {
      setMsg('Укажите короткую тему')
      return
    }
    if (t.length > 80) {
      setMsg('Тема не длиннее 80 символов')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const annotated = await composeAnnotatedPng(shotBlob, markers)
      const id = `fb-${Date.now().toString(36)}`
      const imageId = `fbimg-${id}`
      await saveFeedbackImage(imageId, annotated)
      const now = new Date().toISOString()
      const item = await submitFeedbackWithSync(
        {
          id,
          createdAt: now,
          updatedAt: now,
          title: t,
          body: body.trim(),
          kind,
          status: 'new',
          authorId: user.id,
          authorName: user.name,
          authorRole: user.role,
          route: location.pathname + location.search,
          pageTitle: routeTitle(location.pathname),
          buildStamp: BUILD_STAMP,
          markers,
          imageId,
          syncStatus: 'pending',
        },
        annotated,
      )
      onSubmitted?.(item.id)
      const syncNote =
        item.syncStatus === 'synced'
          ? ' · отправлено в API'
          : item.syncStatus === 'local'
            ? ' · только локально (API не настроен)'
            : item.syncStatus === 'error'
              ? ' · локально, sync ошибка'
              : ''
      setMsg(`Отправлено · ${item.id}${syncNote}`)
      setTimeout(() => {
        onClose()
        reset()
      }, 900)
    } catch {
      setMsg('Не удалось сохранить замечание')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      data-feedback-ui
      className="fixed inset-0 z-[80] flex items-end justify-center bg-gray-900/50 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Замечание</p>
            <p className="text-[11px] text-gray-500">
              {step === 'shot' && 'Снимок экрана'}
              {step === 'mark' && 'Выделите области'}
              {step === 'form' && 'Тема и описание'}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            onClick={() => {
              onClose()
              reset()
            }}
            aria-label="Закрыть"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {step === 'shot' && (
            <p className="text-sm text-gray-600">
              {busy ? 'Делаем снимок…' : msg || 'Нажмите «Переснять», если кадр пустой.'}
            </p>
          )}

          {(step === 'mark' || step === 'form') && shotUrl && (
            <div className="space-y-3">
              {step === 'mark' && (
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['rect', RiCheckboxBlankLine, 'Рамка'],
                      ['pin', RiMapPinLine, 'Пин'],
                      ['arrow', RiArrowRightUpLine, 'Стрелка'],
                      ['text', RiText, 'Текст'],
                    ] as const
                  ).map(([id, Icon, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTool(id)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                        tool === id
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="ml-auto text-xs text-gray-500 hover:text-gray-800"
                    onClick={() => setMarkers([])}
                  >
                    Очистить метки
                  </button>
                </div>
              )}

              <div
                className={`relative overflow-hidden rounded-md border border-gray-200 bg-gray-100 ${
                  step === 'mark' ? 'cursor-crosshair' : ''
                }`}
                onPointerDown={step === 'mark' ? onPointerDown : undefined}
                onPointerMove={step === 'mark' ? onPointerMove : undefined}
                onPointerUp={step === 'mark' ? onPointerUp : undefined}
              >
                <img
                  ref={imgRef}
                  src={shotUrl}
                  alt="Снимок"
                  className="pointer-events-none block max-h-[50vh] w-full object-contain"
                  draggable={false}
                />
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  {markers.map((m) => (
                    <MarkerSvg key={m.id} m={m} />
                  ))}
                  {draft && draft.x2 != null && draft.y2 != null && tool === 'rect' && (
                    <rect
                      x={`${Math.min(draft.x, draft.x2)}%`}
                      y={`${Math.min(draft.y, draft.y2)}%`}
                      width={`${Math.abs(draft.x2 - draft.x)}%`}
                      height={`${Math.abs(draft.y2 - draft.y)}%`}
                      fill="none"
                      stroke="#C00000"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                  )}
                  {draft && draft.x2 != null && draft.y2 != null && tool === 'arrow' && (
                    <line
                      x1={`${draft.x}%`}
                      y1={`${draft.y}%`}
                      x2={`${draft.x2}%`}
                      y2={`${draft.y2}%`}
                      stroke="#C00000"
                      strokeWidth={2}
                    />
                  )}
                </svg>
              </div>

              {markers.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 text-[11px] text-gray-600">
                  {markers.map((m) => (
                    <li
                      key={m.id}
                      className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5"
                    >
                      {m.label}. {m.type}
                      {m.note ? `: ${m.note}` : ''}
                      <button
                        type="button"
                        className="ml-1 text-red-500"
                        onClick={() => setMarkers((prev) => prev.filter((x) => x.id !== m.id))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {step === 'form' && (
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-0.5 block text-xs text-gray-500">Тема *</span>
                    <input
                      className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                      value={title}
                      maxLength={80}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Коротко: что не так / что улучшить"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-xs text-gray-500">Описание</span>
                    <textarea
                      className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                      rows={3}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Детали предполагаемого изменения"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-xs text-gray-500">Тип</span>
                    <select
                      className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                      value={kind}
                      onChange={(e) => setKind(e.target.value as FeedbackKind)}
                    >
                      <option value="ux">UX</option>
                      <option value="bug">Баг</option>
                      <option value="idea">Идея</option>
                    </select>
                  </label>
                  <p className="text-[11px] text-gray-400">
                    {routeTitle(location.pathname)} · {location.pathname} · {BUILD_STAMP} ·{' '}
                    {user?.name}
                  </p>
                </div>
              )}
            </div>
          )}

          {msg && (
            <p
              className={`mt-2 text-xs ${
                msg.startsWith('Отправлено') ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {msg}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void capture()}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Переснять
          </button>
          <div className="ml-auto flex gap-2">
            {step === 'mark' && (
              <button
                type="button"
                onClick={() => setStep('form')}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Далее
              </button>
            )}
            {step === 'form' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('mark')}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
                >
                  Назад
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onSubmit()}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? '…' : 'Отправить'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MarkerSvg({ m }: { m: FeedbackMarker }) {
  const stroke = '#C00000'
  if (m.type === 'rect' && m.w != null && m.h != null) {
    return (
      <>
        <rect
          x={`${m.x}%`}
          y={`${m.y}%`}
          width={`${m.w}%`}
          height={`${m.h}%`}
          fill="rgba(192,0,0,0.08)"
          stroke={stroke}
          strokeWidth={2}
        />
        <Badge x={m.x} y={m.y} label={m.label} />
      </>
    )
  }
  if (m.type === 'arrow' && m.x2 != null && m.y2 != null) {
    return (
      <>
        <line
          x1={`${m.x}%`}
          y1={`${m.y}%`}
          x2={`${m.x2}%`}
          y2={`${m.y2}%`}
          stroke={stroke}
          strokeWidth={2}
          markerEnd="url(#fb-arrow)"
        />
        <Badge x={m.x} y={m.y} label={m.label} />
      </>
    )
  }
  return (
    <>
      <Badge x={m.x} y={m.y} label={m.label} />
      {m.note && (
        <text x={`${m.x}%`} y={`${m.y}%`} dx={14} dy={4} fill={stroke} fontSize={11}>
          {m.note}
        </text>
      )}
    </>
  )
}

function Badge({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <circle cx={`${x}%`} cy={`${y}%`} r={10} fill="#C00000" />
      <text
        x={`${x}%`}
        y={`${y}%`}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={10}
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  )
}

/** FAB + открытие мастера. */
export function FeedbackFab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      data-feedback-ui
      onClick={onOpen}
      title="Оставить замечание"
      aria-label="Оставить замечание"
      className="fixed bottom-5 right-5 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-700 lg:bottom-6 lg:right-6"
    >
      <RiAddLine className="h-6 w-6" />
    </button>
  )
}
