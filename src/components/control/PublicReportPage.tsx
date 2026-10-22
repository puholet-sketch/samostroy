import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function parseReportDate(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return todayIso()
}

function formatDateRu(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function PublicReportPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const link = useMemo(() => (token ? resolveControlLink(token) : null), [token])
  const date = parseReportDate(searchParams.get('date'))

  const [workDone, setWorkDone] = useState('')
  const [problems, setProblems] = useState('')
  const [media, setMedia] = useState<ReportMediaMeta[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    document.title = 'Отчёт по объекту — СамоСтрой'
  }, [])

  useEffect(() => {
    if (!token) return
    const existing = getReportForDate(token, date)
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
        setMsg(`Файл «${file.name}» слишком большой (макс. ${formatBytes(MAX_ATTACHMENT_BYTES)})`)
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
        workDone: workDone.trim(),
        problems: problems.trim(),
        media,
      })
      setSent(true)
      setMsg('Отчёт сохранён. Спасибо!')
    } catch {
      setMsg('Не удалось сохранить отчёт')
    } finally {
      setBusy(false)
    }
  }

  if (!token || !link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-600">Ссылка недействительна</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <BrandLogo to={null} size="md" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-xl font-semibold text-gray-900">Отчёт по объекту</h1>
        <p className="mt-1 text-sm text-gray-500">
          {link.objectTitle} · {link.objectAddress}
        </p>

        {sent && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Отчёт за {formatDateRu(date)} принят. Можно дополнить и отправить снова.
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Дата отчёта</span>
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => {
                  const v = e.target.value
                  if (!v) return
                  setSearchParams({ date: v }, { replace: true })
                }}
              />
              <span className="mt-1 block text-xs text-gray-400">{formatDateRu(date)}</span>
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                Фото / видео
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                capture="environment"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700"
                onChange={(e) => void onFiles(e)}
              />
            </label>
            {media.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {media.map((m) => (
                  <li key={m.id} className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                    {m.kind === 'image' && previews[m.id] ? (
                      <img src={previews[m.id]} alt={m.name} className="h-24 w-full object-cover" />
                    ) : m.kind === 'video' && previews[m.id] ? (
                      <video src={previews[m.id]} className="h-24 w-full object-cover" muted />
                    ) : (
                      <div className="flex h-24 items-center justify-center px-2 text-center text-xs text-gray-500">
                        {m.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(m.id)}
                      className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                    >
                      ×
                    </button>
                    <p className="truncate px-1.5 py-1 text-[10px] text-gray-500">
                      {formatBytes(m.size)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                Описание проделанных работ
              </span>
              <textarea
                className={inputCls}
                rows={4}
                required
                value={workDone}
                onChange={(e) => setWorkDone(e.target.value)}
                placeholder="Что сделали сегодня…"
              />
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                Проблемы / вопросы
              </span>
              <textarea
                className={inputCls}
                rows={3}
                value={problems}
                onChange={(e) => setProblems(e.target.value)}
                placeholder="Если всё ок — оставьте пустым"
              />
            </label>
          </div>

          {msg && (
            <p
              className={`text-sm ${
                msg.includes('Сохран') || msg.includes('Спасибо') ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Отправка…' : sent ? 'Обновить отчёт' : 'Отправить отчёт'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          <Link to="/login" className="text-blue-600 hover:underline">
            Вход в CRM
          </Link>
        </p>
      </main>
    </div>
  )
}
