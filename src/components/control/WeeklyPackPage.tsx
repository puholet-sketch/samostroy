import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import { getMediaBlob } from '../../lib/mediaStore'
import { fetchReportMediaRemote, isObjectReportsApiConfigured } from '../../lib/objectReportsApi'
import {
  buildWeeklyPack,
  shiftWeekSatFri,
  weekLabelRu,
  type WeeklyPack,
  type WeeklyPackDay,
} from '../../lib/weeklyPack'

function formatRuDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function DayMediaNav({ day }: { day: WeeklyPackDay }) {
  const images = day.media.filter((m) => m.kind === 'image')
  const [idx, setIdx] = useState(0)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setIdx(0)
  }, [day.date, images.length])

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    ;(async () => {
      const m = images[idx]
      if (!m) {
        setUrl(null)
        return
      }
      let blob = await getMediaBlob(m.id)
      if (!blob && isObjectReportsApiConfigured()) {
        try {
          blob = await fetchReportMediaRemote(m.id)
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return
      if (blob) {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } else {
        setUrl(null)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [images, idx])

  if (images.length === 0) {
    return <p className="text-xs text-gray-400">Нет фото за день</p>
  }

  return (
    <div className="mt-2">
      <div className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {url ? (
          <img
            src={url}
            alt={images[idx]?.name || 'фото'}
            className="mx-auto max-h-64 w-full object-contain"
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-gray-400">
            Медиа недоступно в этом браузере (нужен sync API / то же устройство)
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото"
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow hover:bg-white"
              onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            >
              <RiArrowLeftSLine className="h-5 w-5 text-gray-800" />
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow hover:bg-white"
              onClick={() => setIdx((i) => (i + 1) % images.length)}
            >
              <RiArrowRightSLine className="h-5 w-5 text-gray-800" />
            </button>
          </>
        )}
      </div>
      <p className="mt-1 text-center text-[11px] text-gray-500">
        Фото {idx + 1} / {images.length}
        {images[idx]?.name ? ` · ${images[idx].name}` : ''}
      </p>
    </div>
  )
}

export default function WeeklyPackPage() {
  const [params, setSearchParams] = useSearchParams()
  const clientId = params.get('clientId') || ''
  const objectId = params.get('objectId') || ''
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''

  const [pack, setPack] = useState<WeeklyPack | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    document.title = 'Еженедельный пакет — СамоСтрой'
  }, [])

  useEffect(() => {
    if (!clientId || !objectId) {
      setPack(null)
      setErr('Выберите объект в Контроле и откройте «Пакет клиенту»')
      return
    }
    let cancelled = false
    setBusy(true)
    setErr('')
    ;(async () => {
      try {
        const next = await buildWeeklyPack({
          clientId,
          objectId,
          from: fromParam || undefined,
          to: toParam || undefined,
        })
        if (cancelled) return
        if (!next) {
          setPack(null)
          setErr('Клиент или объект не найдены')
          return
        }
        setPack(next)
        // нормализуем URL на полную неделю
        if (next.from !== fromParam || next.to !== toParam) {
          setSearchParams(
            {
              clientId,
              objectId,
              from: next.from,
              to: next.to,
            },
            { replace: true },
          )
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, objectId, fromParam, toParam, setSearchParams])

  const title = useMemo(() => {
    if (!pack) return 'Еженедельный пакет клиенту'
    return `${pack.objectAddress || pack.objectTitle} · ${weekLabelRu(pack.from, pack.to)}`
  }, [pack])

  function shiftWeek(delta: number) {
    if (!pack) return
    const next = shiftWeekSatFri(pack.from, delta)
    setSearchParams({
      clientId,
      objectId,
      from: next.from,
      to: next.to,
    })
  }

  return (
    <div className="weekly-pack">
      <style>{`
        .weekly-pack {
          --ink: #1a1a1a;
          --text: #333;
          --muted: #666;
          --line: #d4d4d4;
          font-family: "Segoe UI", system-ui, sans-serif;
          color: var(--text);
          background: #fff;
          min-height: 100vh;
          padding: 1rem 1.25rem 2.5rem;
        }
        .weekly-pack .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 1rem;
        }
        .weekly-pack h1 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 0.25rem;
        }
        .weekly-pack .meta {
          font-size: 0.8rem;
          color: var(--muted);
          margin-bottom: 1rem;
        }
        .weekly-pack .day {
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 0.75rem 1rem;
          margin-bottom: 0.75rem;
          break-inside: avoid;
        }
        .weekly-pack .day.miss {
          background: #fafafa;
        }
        .weekly-pack .day-head {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: baseline;
          margin-bottom: 0.35rem;
        }
        .weekly-pack .day-head strong {
          color: var(--ink);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.04em;
        }
        .weekly-pack .badge {
          font-size: 0.65rem;
          font-weight: 600;
          padding: 0.1rem 0.4rem;
          border-radius: 3px;
        }
        .weekly-pack .badge.ok { background: #d1fae5; color: #065f46; }
        .weekly-pack .badge.no { background: #ffe4e6; color: #9f1239; }
        @media print {
          .weekly-pack .no-print { display: none !important; }
          .weekly-pack { padding: 0; }
        }
      `}</style>

      <div className="toolbar no-print">
        <Link
          to="/control"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
        >
          ← Контроль
        </Link>
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => shiftWeek(-1)}
          disabled={!pack}
        >
          ← Нед.
        </button>
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => shiftWeek(1)}
          disabled={!pack}
        >
          Нед. →
        </button>
        <button
          type="button"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          onClick={() => window.print()}
          disabled={!pack}
        >
          Печать / PDF
        </button>
      </div>

      <h1>{title}</h1>
      {pack && (
        <p className="meta">
          Клиент: <strong>{pack.clientName || '—'}</strong>
          {' · '}
          Неделя сб→пт (день отчёта — пятница {formatRuDate(pack.reportDay)})
          {' · '}
          Отчётов: {pack.filledDays}/{pack.days.length}
          {' · '}
          Медиа: {pack.mediaTotal}
        </p>
      )}

      {busy && <p className="text-sm text-gray-500">Собираем пакет…</p>}
      {err && !busy && <p className="text-sm text-rose-700">{err}</p>}

      {pack &&
        pack.days.map((day) => (
          <section key={day.date} className={`day${!day.report ? ' miss' : ''}`}>
            <div className="day-head">
              <strong>{day.weekdayRu}</strong>
              <span className="tabular-nums text-sm text-gray-800">{formatRuDate(day.date)}</span>
              <span className={`badge ${day.report ? 'ok' : 'no'}`}>
                {day.report ? 'есть отчёт' : 'нет отчёта'}
              </span>
              {day.report?.workerName && (
                <span className="text-xs text-gray-500">{day.report.workerName}</span>
              )}
            </div>
            {day.report ? (
              <>
                <p className="text-sm text-gray-800">
                  <span className="text-xs font-medium text-gray-500">Сделано: </span>
                  {day.shortWork || '—'}
                </p>
                {day.shortProblems && (
                  <p className="mt-1 text-sm text-amber-900">
                    <span className="text-xs font-medium text-amber-700">Проблемы: </span>
                    {day.shortProblems}
                  </p>
                )}
                <DayMediaNav day={day} />
              </>
            ) : (
              <p className="text-sm text-gray-400">Прораб не сдал дневной отчёт</p>
            )}
          </section>
        ))}
    </div>
  )
}
