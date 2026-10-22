import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RiAttachment2 } from '@remixicon/react'
import {
  attachmentKind,
  formatBytes,
  getMediaBlob,
  MAX_ATTACHMENT_BYTES,
  putMediaBlob,
} from '../../lib/mediaStore'
import {
  getReportForDate,
  resolveControlLink,
  saveDailyReport,
  todayIso,
  type ReportMediaMeta,
} from '../../lib/objectReports'
import { BrandLogo } from '../common/BrandLogo'

const inputCls =
  'block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function parseReportDate(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return todayIso()
}

export default function PublicReportPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const link = useMemo(() => (token ? resolveControlLink(token) : null), [token])
  const date = parseReportDate(searchParams.get('date'))
  const fileRef = useRef<HTMLInputElement>(null)

  const [workerName, setWorkerName] = useState('')
  const [workDone, setWorkDone] = useState('')
  const [problems, setProblems] = useState('')
  const [media, setMedia] = useState<ReportMediaMeta[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  const address =
    link?.objectAddress?.trim() ||
    link?.objectTitle?.trim() ||
    'Адрес уточняется'

  useEffect(() => {
    document.title = 'Отчёт по объекту — СамоСтрой'
  }, [])

  useEffect(() => {
    if (!token) return
    const existing = getReportForDate(token, date)
    setWorkerName(existing?.workerName ?? '')
    setWorkDone(existing?.workDone ?? '')
    setProblems(existing?.problems ?? '')
    setMedia(existing?.media ?? [])
    setSent(Boolean(existing))
    setMsg('')
  }, [token, date])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      for (const m of media) {
        const blob = await getMediaBlob(m.id)
        if (blob && !cancelled) next[m.id] = URL.createObjectURL(blob)
      }
      if (!cancelled) {
        setPreviews((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
          return next
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, date, media])

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previews])

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setMsg('')
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setMsg(`«${file.name}» слишком большой (макс. ${formatBytes(MAX_ATTACHMENT_BYTES)})`)
        continue
      }
      const kind = attachmentKind(file.type)
      if (kind === 'file') {
        setMsg(`«${file.name}» — нужны фото или видео`)
        continue
      }
      const id = `ormedia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      await putMediaBlob(id, file)
      const meta: ReportMediaMeta = {
        id,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        kind,
      }
      setMedia((prev) => [...prev, meta])
      setPreviews((prev) => ({ ...prev, [id]: URL.createObjectURL(file) }))
    }
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id))
    setPreviews((prev) => {
      const next = { ...prev }
      if (next[id]) URL.revokeObjectURL(next[id])
      delete next[id]
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token || !link) return
    if (!workerName.trim()) {
      setMsg('Укажите ваше имя')
      return
    }
    if (!workDone.trim()) {
      setMsg('Опишите проделанные работы')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      saveDailyReport({
        token,
        date,
        workerName: workerName.trim(),
        workDone: workDone.trim(),
        problems: problems.trim(),
        media,
      })
      setSent(true)
      setMsg('Отчёт сохранён')
    } catch {
      setMsg('Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  if (!token || !link) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-600">Ссылка недействительна</p>
      </div>
    )
  }

  const hasMedia = media.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-12 max-w-lg items-center gap-3 px-3 sm:px-4">
          <BrandLogo to={null} size="sm" />
          <span className="h-4 w-px shrink-0 bg-gray-200" aria-hidden />
          <h1 className="truncate text-sm font-semibold text-gray-900">Отчёт по объекту</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-3 py-3 sm:px-4">
        {sent && (
          <p className="mb-2 text-xs text-emerald-700">Принят · можно дополнить и отправить снова</p>
        )}

        <form onSubmit={onSubmit} className="space-y-2.5">
          {/* ФИО + адрес */}
          <div className="space-y-1">
            <input
              className={inputCls}
              required
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="Ваше ФИО"
              autoComplete="name"
            />
            <p className="truncate text-xs text-gray-500" title={address}>
              {address}
            </p>
          </div>

          {/* Дата + скрепка в одну строку */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="w-[9.5rem] shrink-0 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs tabular-nums text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={date}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                setSearchParams({ date: v }, { replace: true })
              }}
              aria-label="Дата отчёта"
            />

            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              capture="environment"
              className="sr-only"
              onChange={(e) => void onFiles(e)}
            />
            <button
              type="button"
              title={hasMedia ? `Вложений: ${media.length}` : 'Прикрепить фото / видео'}
              aria-label={hasMedia ? `Вложений: ${media.length}` : 'Прикрепить фото или видео'}
              onClick={() => fileRef.current?.click()}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                hasMedia
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                  : 'border-rose-300 bg-rose-50 text-rose-600'
              }`}
            >
              <RiAttachment2 className="h-5 w-5" />
            </button>
            {hasMedia && (
              <span className="text-xs tabular-nums text-emerald-700">{media.length}</span>
            )}
          </div>

          {hasMedia && (
            <ul className="flex flex-wrap gap-1.5">
              {media.map((m) => (
                <li
                  key={m.id}
                  className="relative h-12 w-12 overflow-hidden rounded border border-gray-200 bg-gray-100"
                >
                  {m.kind === 'image' && previews[m.id] ? (
                    <img src={previews[m.id]} alt="" className="h-full w-full object-cover" />
                  ) : m.kind === 'video' && previews[m.id] ? (
                    <video src={previews[m.id]} className="h-full w-full object-cover" muted />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[9px] text-gray-500">
                      файл
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(m.id)}
                    className="absolute right-0 top-0 bg-black/60 px-1 text-[10px] leading-none text-white"
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <textarea
            className={inputCls}
            rows={3}
            required
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            placeholder="Что сделали сегодня…"
          />

          <textarea
            className={inputCls}
            rows={2}
            value={problems}
            onChange={(e) => setProblems(e.target.value)}
            placeholder="Проблемы / вопросы (если есть)"
          />

          {msg && (
            <p
              className={`text-xs ${
                msg.includes('сохран') || msg.includes('Принят') ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? '…' : sent ? 'Обновить' : 'Отправить'}
          </button>
        </form>

        <p className="mt-3 text-center text-[11px] text-gray-400">
          <Link to="/login" className="text-blue-600 hover:underline">
            Вход в CRM
          </Link>
        </p>
      </main>
    </div>
  )
}
