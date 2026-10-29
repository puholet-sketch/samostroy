import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RiAttachment2 } from '@remixicon/react'
import {
  attachmentKind,
  formatBytes,
  getMediaBlob,
  putMediaBlob,
} from '../../lib/mediaStore'
import {
  getReportForDate,
  hydrateReportsForToken,
  resolveControlLink,
  resolveControlLinkAsync,
  saveDailyReport,
  saveDailyReportAsync,
  todayIso,
  type ControlLink,
  type ReportMediaMeta,
} from '../../lib/objectReports'
import { BrandLogo } from '../common/BrandLogo'

/** Суммарный лимит вложений на один отчёт */
const MAX_REPORT_MEDIA_BYTES = 5 * 1024 * 1024

const inputCls =
  'block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function clampDateToToday(iso: string): string {
  const today = todayIso()
  return iso > today ? today : iso
}

function parseReportDate(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return clampDateToToday(raw)
  return todayIso()
}

export default function PublicReportPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [link, setLink] = useState<ControlLink | null>(() =>
    token ? resolveControlLink(token) : null,
  )
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

  useEffect(() => {
    if (!token) {
      setLink(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const resolved = await resolveControlLinkAsync(token)
      if (!cancelled) setLink(resolved)
      await hydrateReportsForToken(token)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const address =
    link?.objectAddress?.trim() ||
    link?.objectTitle?.trim() ||
    'Адрес уточняется'

  const today = todayIso()
  const mediaTotalBytes = media.reduce((s, m) => s + (m.size || 0), 0)

  useEffect(() => {
    document.title = 'Отчёт по объекту — СамоСтрой'
  }, [])

  // если в URL дата в будущем — откатить на сегодня
  useEffect(() => {
    const raw = searchParams.get('date')
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw > today) {
      setSearchParams({ date: today }, { replace: true })
    }
  }, [searchParams, today, setSearchParams])

  useEffect(() => {
    if (!token) return
    let cancelled = false

    function applyLocal() {
      const existing = getReportForDate(token, date)
      setWorkerName(existing?.workerName ?? '')
      setWorkDone(existing?.workDone ?? '')
      setProblems(existing?.problems ?? '')
      setMedia(existing?.media ?? [])
      setSent(Boolean(existing))
    }

    // Сразу из localStorage — не ждать API (иначе форма пустая / «пропал» отчёт)
    applyLocal()
    setMsg('')

    ;(async () => {
      await hydrateReportsForToken(token)
      if (cancelled) return
      applyLocal()
    })()
    return () => {
      cancelled = true
    }
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
    let used = media.reduce((s, m) => s + (m.size || 0), 0)
    for (const file of files) {
      const kind = attachmentKind(file.type)
      if (kind === 'file') {
        setMsg(`«${file.name}» — нужны фото или видео`)
        continue
      }
      if (used + file.size > MAX_REPORT_MEDIA_BYTES) {
        setMsg(
          `Лимит вложений ${formatBytes(MAX_REPORT_MEDIA_BYTES)} на отчёт. Сейчас ${formatBytes(used)}, «${file.name}» не помещается.`,
        )
        break
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
      used += file.size
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
    if (date > todayIso()) {
      setMsg('Дата не может быть позже сегодняшней')
      return
    }
    const total = media.reduce((s, m) => s + (m.size || 0), 0)
    if (total > MAX_REPORT_MEDIA_BYTES) {
      setMsg(`Вложения больше ${formatBytes(MAX_REPORT_MEDIA_BYTES)}`)
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const { synced, error } = await saveDailyReportAsync({
        token,
        date,
        workerName: workerName.trim(),
        workDone: workDone.trim(),
        problems: problems.trim(),
        media,
      })
      setSent(true)
      // media мог получить remote:true после upload
      const latest = getReportForDate(token, date)
      if (latest?.media) setMedia(latest.media)
      if (synced) setMsg('Отчёт сохранён в общую базу')
      else if (error) setMsg(`Сохранено локально (API: ${error})`)
      else setMsg('Отчёт сохранён (только в этом браузере — API не настроен)')
    } catch (e) {
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
        setMsg(
          `Сохранено локально (${e instanceof Error ? e.message : 'ошибка сети'})`,
        )
      } catch {
        setMsg('Не удалось сохранить')
      }
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
          <p className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[11px] leading-snug text-emerald-900">
            Форма для <strong>прораба</strong> по этому объекту. Строители отчёт не заполняют.
          </p>

          {/* ФИО + адрес */}
          <div className="space-y-1">
            <input
              className={inputCls}
              required
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="ФИО прораба"
              autoComplete="name"
            />
            <p className="truncate text-xs font-medium text-gray-700" title={address}>
              Объект: {address}
            </p>
          </div>

          {/* Дата + скрепка в одну строку */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              max={today}
              className="w-[9.5rem] shrink-0 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs tabular-nums text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={date}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                setSearchParams({ date: clampDateToToday(v) }, { replace: true })
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
              title={
                hasMedia
                  ? `Вложений: ${media.length} · ${formatBytes(mediaTotalBytes)} / ${formatBytes(MAX_REPORT_MEDIA_BYTES)}`
                  : `Прикрепить фото / видео (до ${formatBytes(MAX_REPORT_MEDIA_BYTES)} суммарно)`
              }
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
              <span className="text-xs tabular-nums text-emerald-700">
                {media.length} · {formatBytes(mediaTotalBytes)}
              </span>
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

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
              Что сделали сегодня (результат работ)
            </label>
            <textarea
              className={inputCls}
              rows={3}
              required
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              placeholder="Напр.: поклейка обоев в гостиной; возведены перегородки в санузле; залита стяжка на кухне"
            />
            <p className="mt-0.5 text-[10px] leading-snug text-gray-400">
              Пишите результат («поклейка стен»), а не сопутствующее («мешал бетон», «сверлил»).
            </p>
          </div>

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
              Проблемы / вопросы
            </label>
            <textarea
              className={inputCls}
              rows={2}
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
              placeholder="Напр.: нет материала на затирку; вопрос по розеткам на кухне; ждём поставку двери"
            />
          </div>

          <details className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-600">
            <summary className="cursor-pointer select-none font-medium text-gray-700">
              Как заполнять отчёт
            </summary>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-snug">
              <li>
                <strong>Работы:</strong> итог за день — «поклейка стен», «возведены перегородки»,
                «уложена плитка в санузле».
              </li>
              <li>
                <strong>Не писать:</strong> помехи и процесс без результата («мешал бетон»,
                «ждал доставку» — это в проблемы).
              </li>
              <li>
                <strong>Фото/видео:</strong> кнопка со скрепкой · до 5 МБ суммарно · лучше
                результат работ и проблемные места.
              </li>
              <li>
                <strong>Проблемы:</strong> чего не хватает, вопросы к офису, риски срыва срока.
              </li>
            </ul>
          </details>

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
