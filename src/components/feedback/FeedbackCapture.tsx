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
import {
  feedbackSubmitSucceeded,
  feedbackSubmitUserMessage,
  submitFeedbackWithSync,
} from '../../lib/feedbackApi'
import {
  saveFeedbackImage,
  type FeedbackKind,
  type FeedbackMarker,
  type FeedbackMarkerType,
} from '../../lib/feedbackStore'
import { routeTitle } from '../layout/routes'

type Step = 'shot' | 'mark' | 'form'

type Tool = FeedbackMarkerType

type Draft = { x: number; y: number; x2: number; y2: number }

type TextDraft = { x: number; y: number; value: string }

type Props = {
  open: boolean
  onClose: () => void
  onSubmitted?: (id: string) => void
}

const MIN_DRAG_PCT = 1.2
/** Верхняя граница высоты кадра (canvas OOM на длинных страницах / mobile). */
const MAX_CAPTURE_HEIGHT = 14_000

/** Visible image box inside an object-contain <img> (may be letterboxed). */
function objectContainContentRect(img: HTMLImageElement): DOMRect {
  const box = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh || box.width < 1 || box.height < 1) return box
  const scale = Math.min(box.width / nw, box.height / nh)
  const w = nw * scale
  const h = nh * scale
  return new DOMRect(box.left + (box.width - w) / 2, box.top + (box.height - h) / 2, w, h)
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
  const [draft, setDraft] = useState<Draft | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<FeedbackKind>('ux')
  /** Overlay inset % relative to surface (matches object-contain content). */
  const [overlayInset, setOverlayInset] = useState({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  })
  const surfaceRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const contentRectRef = useRef<DOMRect | null>(null)
  const draftRef = useRef<Draft | null>(null)
  const drawingRef = useRef(false)
  const textInputRef = useRef<HTMLInputElement>(null)
  /** Ignore leftover pointer/click after opening text sheet or switching tools. */
  const suppressPointerUntilRef = useRef(0)

  const reset = useCallback(() => {
    if (shotUrl) URL.revokeObjectURL(shotUrl)
    setShotUrl(null)
    setShotBlob(null)
    setStep('shot')
    setMarkers([])
    setDraft(null)
    draftRef.current = null
    drawingRef.current = false
    setTextDraft(null)
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

  useEffect(() => {
    if (!textDraft) return
    const t = window.setTimeout(() => textInputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [textDraft])

  const syncOverlayToImage = useCallback(() => {
    const surface = surfaceRef.current
    const img = imgRef.current
    if (!surface || !img) return
    const sr = surface.getBoundingClientRect()
    const cr = objectContainContentRect(img)
    contentRectRef.current = cr
    if (sr.width < 1 || sr.height < 1) return
    setOverlayInset({
      left: ((cr.left - sr.left) / sr.width) * 100,
      top: ((cr.top - sr.top) / sr.height) * 100,
      width: (cr.width / sr.width) * 100,
      height: (cr.height / sr.height) * 100,
    })
  }, [])

  useEffect(() => {
    if (!shotUrl || step === 'shot') return
    syncOverlayToImage()
    const onResize = () => syncOverlayToImage()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [shotUrl, step, syncOverlayToImage])

  async function capture() {
    setBusy(true)
    setMsg('')
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const feedbackEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-feedback-ui]'),
    )
    const prevVisibility = feedbackEls.map((el) => el.style.visibility)
    feedbackEls.forEach((el) => {
      el.style.visibility = 'hidden'
    })
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      // Полный scrollable документ / #root — иначе html-to-image берёт только viewport
      const root = document.getElementById('root')
      const node = (root ?? document.documentElement) as HTMLElement
      const width = Math.max(
        node.scrollWidth,
        document.documentElement.scrollWidth,
        document.body?.scrollWidth ?? 0,
        window.innerWidth,
      )
      const fullHeight = Math.max(
        node.scrollHeight,
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        window.innerHeight,
      )
      const height = Math.min(fullHeight, MAX_CAPTURE_HEIGHT)
      const pixelRatio = Math.min(1.5, window.devicePixelRatio || 1)

      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio,
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: 'none',
          overflow: 'visible',
        },
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
      if (fullHeight > MAX_CAPTURE_HEIGHT) {
        setMsg('Снимок обрезан по высоте (очень длинная страница)')
      }
    } catch {
      setMsg('Не удалось сделать снимок экрана')
      setStep('shot')
    } finally {
      feedbackEls.forEach((el, i) => {
        el.style.visibility = prevVisibility[i] ?? ''
      })
      window.scrollTo(scrollX, scrollY)
      setBusy(false)
    }
  }

  function pctFromEvent(e: ReactPointerEvent | PointerEvent) {
    const img = imgRef.current
    const rect = contentRectRef.current ?? (img ? objectContainContentRect(img) : null)
    if (!rect || rect.width < 1 || rect.height < 1) return null
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return {
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    }
  }

  function selectTool(next: Tool) {
    setTool(next)
    setDraft(null)
    draftRef.current = null
    drawingRef.current = false
    setTextDraft(null)
    suppressPointerUntilRef.current = performance.now() + 300
  }

  function commitTextDraft(note: string | null) {
    if (!textDraft) return
    const trimmed = note?.trim()
    if (trimmed) {
      const label = String(markers.length + 1)
      setMarkers((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          type: 'text',
          x: textDraft.x,
          y: textDraft.y,
          label,
          note: trimmed,
        },
      ])
    }
    setTextDraft(null)
    suppressPointerUntilRef.current = performance.now() + 400
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (step !== 'mark' || textDraft) return
    if (performance.now() < suppressPointerUntilRef.current) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = pctFromEvent(e)
    if (!p) return

    if (tool === 'pin') {
      e.preventDefault()
      const label = String(markers.length + 1)
      setMarkers((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, type: 'pin', x: p.x, y: p.y, label },
      ])
      suppressPointerUntilRef.current = performance.now() + 250
      return
    }

    if (tool === 'text') {
      e.preventDefault()
      // Open sheet on this tap only; block residual pointerup/click from re-opening.
      suppressPointerUntilRef.current = performance.now() + 600
      setTextDraft({ x: p.x, y: p.y, value: '' })
      return
    }

    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drawingRef.current = true
    const next: Draft = { x: p.x, y: p.y, x2: p.x, y2: p.y }
    draftRef.current = next
    setDraft(next)
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drawingRef.current || !draftRef.current) return
    const p = pctFromEvent(e)
    if (!p) return
    const next: Draft = { ...draftRef.current, x2: p.x, y2: p.y }
    draftRef.current = next
    setDraft(next)
  }

  function finishDrag(e: ReactPointerEvent) {
    if (!drawingRef.current) return
    drawingRef.current = false
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      /* already released */
    }
    const d = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (!d) return

    const dx = d.x2 - d.x
    const dy = d.y2 - d.y
    const len = Math.hypot(dx, dy)
    const label = String(markers.length + 1)

    if (tool === 'rect') {
      const x = Math.min(d.x, d.x2)
      const y = Math.min(d.y, d.y2)
      const w = Math.abs(dx)
      const h = Math.abs(dy)
      if (w < MIN_DRAG_PCT || h < MIN_DRAG_PCT) return
      setMarkers((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, type: 'rect', x, y, w, h, label },
      ])
      return
    }

    if (tool === 'arrow') {
      if (len < MIN_DRAG_PCT) return
      setMarkers((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          type: 'arrow',
          x: d.x,
          y: d.y,
          x2: d.x2,
          y2: d.y2,
          label,
        },
      ])
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    finishDrag(e)
  }

  function onPointerCancel(e: ReactPointerEvent) {
    drawingRef.current = false
    draftRef.current = null
    setDraft(null)
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
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
      setMsg(feedbackSubmitUserMessage(item))
      if (feedbackSubmitSucceeded(item)) {
        setTimeout(() => {
          onClose()
          reset()
        }, 1600)
      }
      // При ошибке email оставляем мастер открытым — заказчик видит статус
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
                      onClick={() => selectTool(id)}
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
                ref={surfaceRef}
                className={`relative overflow-hidden rounded-md border border-gray-200 bg-gray-100 ${
                  step === 'mark' ? 'cursor-crosshair touch-none' : ''
                }`}
                onPointerDown={step === 'mark' ? onPointerDown : undefined}
                onPointerMove={step === 'mark' ? onPointerMove : undefined}
                onPointerUp={step === 'mark' ? onPointerUp : undefined}
                onPointerCancel={step === 'mark' ? onPointerCancel : undefined}
              >
                <img
                  ref={imgRef}
                  src={shotUrl}
                  alt="Снимок"
                  className="pointer-events-none block max-h-[50vh] w-full object-contain"
                  draggable={false}
                  onLoad={syncOverlayToImage}
                />
                <svg
                  className="pointer-events-none absolute"
                  style={{
                    left: `${overlayInset.left}%`,
                    top: `${overlayInset.top}%`,
                    width: `${overlayInset.width}%`,
                    height: `${overlayInset.height}%`,
                  }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker
                      id="fb-arrow"
                      viewBox="0 0 10 10"
                      markerWidth="8"
                      markerHeight="8"
                      refX="9"
                      refY="5"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path d="M0,0 L10,5 L0,10 Z" fill="#C00000" />
                    </marker>
                  </defs>
                  {markers.map((m) => (
                    <MarkerSvg key={m.id} m={m} />
                  ))}
                  {draft && tool === 'rect' && (
                    <rect
                      x={Math.min(draft.x, draft.x2)}
                      y={Math.min(draft.y, draft.y2)}
                      width={Math.abs(draft.x2 - draft.x)}
                      height={Math.abs(draft.y2 - draft.y)}
                      fill="none"
                      stroke="#C00000"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {draft && tool === 'arrow' && (
                    <line
                      x1={draft.x}
                      y1={draft.y}
                      x2={draft.x2}
                      y2={draft.y2}
                      stroke="#C00000"
                      strokeWidth={2.5}
                      markerEnd="url(#fb-arrow)"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {textDraft && (
                    <circle
                      cx={textDraft.x}
                      cy={textDraft.y}
                      r={2.2}
                      fill="#C00000"
                      fillOpacity={0.85}
                    />
                  )}
                </svg>
              </div>

              {textDraft && step === 'mark' && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm">
                  <p className="mb-1.5 text-xs font-medium text-gray-700">Подпись на скрине</p>
                  <input
                    ref={textInputRef}
                    type="text"
                    className="mb-2 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                    value={textDraft.value}
                    maxLength={80}
                    placeholder="Короткий текст"
                    onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitTextDraft(textDraft.value)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        commitTextDraft(null)
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600"
                      onClick={() => commitTextDraft(null)}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white"
                      onClick={() => commitTextDraft(textDraft.value)}
                    >
                      Готово
                    </button>
                  </div>
                </div>
              )}

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
                msg.startsWith('Отправлено')
                  ? 'text-emerald-700'
                  : msg.startsWith('Ошибка') || msg.includes('Не удалось')
                    ? 'text-red-600'
                    : 'text-amber-700'
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
                onClick={() => {
                  setTextDraft(null)
                  setStep('form')
                }}
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
          x={m.x}
          y={m.y}
          width={m.w}
          height={m.h}
          fill="rgba(192,0,0,0.08)"
          stroke={stroke}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <Badge x={m.x} y={m.y} label={m.label} />
      </>
    )
  }
  if (m.type === 'arrow' && m.x2 != null && m.y2 != null) {
    return (
      <>
        <line
          x1={m.x}
          y1={m.y}
          x2={m.x2}
          y2={m.y2}
          stroke={stroke}
          strokeWidth={2.5}
          markerEnd="url(#fb-arrow)"
          vectorEffect="non-scaling-stroke"
        />
        <Badge x={m.x} y={m.y} label={m.label} />
      </>
    )
  }
  return (
    <>
      <Badge x={m.x} y={m.y} label={m.label} />
      {m.note && (
        <text
          x={m.x}
          y={m.y}
          dx={3.5}
          dy={1}
          fill={stroke}
          fontSize={3.4}
          fontWeight={600}
        >
          {m.note}
        </text>
      )}
    </>
  )
}

function Badge({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={2.6} fill="#C00000" />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={2.6}
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  )
}

const FAB_GAP_PX = 12
const FAB_BASE_BOTTOM_PX = 20
const FAB_BASE_BOTTOM_LG_PX = 24

/** Поднимает FAB над липкими нижними панелями (`[data-sticky-footer]`). */
function useFabBottomPx(): number {
  const { pathname } = useLocation()
  const [bottomPx, setBottomPx] = useState(FAB_BASE_BOTTOM_PX)

  useEffect(() => {
    const baseBottom = () =>
      window.matchMedia('(min-width: 1024px)').matches
        ? FAB_BASE_BOTTOM_LG_PX
        : FAB_BASE_BOTTOM_PX

    const measure = () => {
      let maxH = 0
      document.querySelectorAll<HTMLElement>('[data-sticky-footer]').forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.height <= 0) return
        if (rect.bottom < window.innerHeight - 4) return
        maxH = Math.max(maxH, Math.ceil(rect.height))
      })
      setBottomPx(maxH > 0 ? maxH + FAB_GAP_PX : baseBottom())
    }

    const ro = new ResizeObserver(measure)
    const bind = () => {
      ro.disconnect()
      document.querySelectorAll('[data-sticky-footer]').forEach((el) => ro.observe(el))
      measure()
    }

    bind()
    // Панель может смонтироваться после перехода по маршруту.
    const t0 = window.setTimeout(bind, 0)
    const t1 = window.setTimeout(bind, 100)
    window.addEventListener('resize', measure)

    return () => {
      ro.disconnect()
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.removeEventListener('resize', measure)
    }
  }, [pathname])

  return bottomPx
}

/** FAB + открытие мастера. */
export function FeedbackFab({ onOpen }: { onOpen: () => void }) {
  const bottomPx = useFabBottomPx()

  return (
    <button
      type="button"
      data-feedback-ui
      onClick={onOpen}
      title="Оставить замечание"
      aria-label="Оставить замечание"
      style={{ bottom: bottomPx }}
      className="fixed right-5 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-700 lg:right-6"
    >
      <RiAddLine className="h-6 w-6" />
    </button>
  )
}
